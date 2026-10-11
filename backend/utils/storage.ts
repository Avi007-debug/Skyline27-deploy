import crypto from 'crypto';
import { badRequest, HttpError } from '../middlewares/errorHandler';
import { env } from '../config/env';

/**
 * Image storage.
 *  - Public assets (event posters, club logos, product images, payment QR codes) go to the
 *    public Supabase bucket (SUPABASE_STORAGE_BUCKET, default `skyline-images`), or the
 *    legacy GoDaddy upload bridge when GODADDY_UPLOAD_URL is configured.
 *  - Sensitive files (expense receipts) go to a private bucket (SUPABASE_PRIVATE_BUCKET,
 *    default `skyline-private`) and are stored as `private://<path>`; readers get a
 *    short-lived signed URL via `signedUrlFor`.
 * Uploads are validated server-side: raster images only (no SVG), max 5 MB.
 */

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PRIVATE_PREFIX = 'private://';

const supabaseUrl = () => (process.env.SUPABASE_URL || '').replace(/[\r\n\s]+/g, '').trim();
const supabaseKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[\r\n\s]+/g, '').trim();
const publicBucket = () => (process.env.SUPABASE_STORAGE_BUCKET || 'skyline-images').trim();
const privateBucket = () => (process.env.SUPABASE_PRIVATE_BUCKET || 'skyline-private').trim();

interface DecodedImage {
  mime: string;
  ext: string;
  buffer: Buffer;
}

/** Validate a data: URL. Throws 400 for unsupported types or oversized files. */
export function decodeImage(dataUrl: string): DecodedImage {
  const match = dataUrl.match(/^data:([A-Za-z0-9.+\/-]+);base64,(.+)$/s);
  if (!match) throw badRequest('Image must be a base64 data URL.');
  const mime = match[1].toLowerCase();
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw badRequest('Unsupported image type. Use JPEG, PNG, WebP or GIF.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw badRequest('Image is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) throw badRequest('Image is larger than 5 MB.');

  // Check magic bytes so a renamed file cannot masquerade as an image.
  const sig = buffer.subarray(0, 12);
  const isJpeg = sig[0] === 0xff && sig[1] === 0xd8;
  const isPng = sig.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = sig.subarray(0, 3).toString('ascii') === 'GIF';
  const isWebp = sig.subarray(0, 4).toString('ascii') === 'RIFF' && sig.subarray(8, 12).toString('ascii') === 'WEBP';
  const ok = (ext === 'jpg' && isJpeg) || (ext === 'png' && isPng) || (ext === 'gif' && isGif) || (ext === 'webp' && isWebp);
  if (!ok) throw badRequest('Image content does not match its declared type.');

  return { mime, ext, buffer };
}

async function uploadToSupabase(bucket: string, path: string, img: DecodedImage): Promise<boolean> {
  const key = supabaseKey();
  const base = supabaseUrl();
  if (!key || !base) return false;
  let response: Response;
  try {
    response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': img.mime, 'x-upsert': 'false' },
      body: img.buffer as any,
    });
  } catch (err: any) {
    // Network/DNS failure (e.g. a mistyped SUPABASE_URL): report it as storage being unavailable, not a crash.
    let host = base;
    try {
      host = new URL(base).host;
    } catch {
      /* keep raw value */
    }
    console.error(`[Storage] Could not reach Supabase Storage at ${host}: ${err?.cause?.code || err?.message}. Check SUPABASE_URL.`);
    return false;
  }
  if (!response.ok) {
    console.warn(`[Storage] Supabase upload to ${bucket} failed with status ${response.status}.`);
  }
  return response.ok;
}

async function uploadToGoDaddy(dataUrl: string, folder: string): Promise<string | null> {
  const url = process.env.GODADDY_UPLOAD_URL;
  if (!url || !env.uploadSecret) return null;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Upload-Secret': env.uploadSecret },
      body: JSON.stringify({ action: 'upload', image: dataUrl, folder }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (response.ok && data.url) {
      let finalUrl: string = data.url;
      if (finalUrl.includes('spotlight.msritise.in/uploads/')) {
        finalUrl = finalUrl.replace(/^https?:\/\/spotlight\.msritise\.in\/uploads\//, 'https://msritise.in/spotlight.msritise.in/uploads/');
      }
      return finalUrl;
    }
    console.warn(`[Storage] GoDaddy upload returned status ${response.status}.`);
  } catch (err: any) {
    console.warn(`[Storage] GoDaddy upload unreachable: ${err.message}`);
  }
  return null;
}

/**
 * Store a public image. Non-data values (existing http(s) URLs) are returned unchanged.
 * Throws 400 on invalid images and 502 when no storage backend accepts the upload,
 * rather than silently persisting a multi-megabyte base64 string in the database.
 */
export async function uploadBase64Image(value: string, folder: string): Promise<string> {
  if (!value || !value.startsWith('data:')) {
    if (value && !/^https?:\/\//i.test(value)) throw badRequest('Image must be an http(s) URL or a data URL.');
    return value;
  }
  const img = decodeImage(value);

  const godaddy = await uploadToGoDaddy(value, folder);
  if (godaddy) return godaddy;

  const path = `${folder}/${crypto.randomUUID()}.${img.ext}`;
  if (await uploadToSupabase(publicBucket(), path, img)) {
    return `${supabaseUrl()}/storage/v1/object/public/${publicBucket()}/${path}`;
  }

  if (!env.isProd) {
    console.warn('[Storage] No storage backend configured; keeping inline data URL (development only).');
    return value;
  }
  throw new HttpError(502, 'Image storage is unavailable. Please try again later.');
}

/** Store a sensitive image in the private bucket. Returns a `private://` reference. */
export async function uploadPrivateImage(value: string, folder: string): Promise<string> {
  if (!value.startsWith('data:')) {
    if (value.startsWith(PRIVATE_PREFIX) || /^https?:\/\//i.test(value)) return value;
    throw badRequest('Receipt must be an image upload.');
  }
  const img = decodeImage(value);
  const path = `${folder}/${crypto.randomUUID()}.${img.ext}`;
  if (await uploadToSupabase(privateBucket(), path, img)) return `${PRIVATE_PREFIX}${path}`;
  if (!env.isProd) {
    console.warn('[Storage] Private bucket unavailable; keeping inline data URL (development only).');
    return value;
  }
  throw new HttpError(502, 'Receipt storage is unavailable. Please try again later.');
}

/** Resolve a stored reference to something a browser can open. Private refs get a 10-minute signed URL. */
export async function signedUrlFor(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (!stored.startsWith(PRIVATE_PREFIX)) return stored;
  const key = supabaseKey();
  const base = supabaseUrl();
  if (!key || !base) return null;
  const path = stored.substring(PRIVATE_PREFIX.length);
  try {
    const response = await fetch(`${base}/storage/v1/object/sign/${privateBucket()}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 600 }),
    });
    const data: any = await response.json().catch(() => ({}));
    const signed = data.signedURL || data.signedUrl;
    return response.ok && signed ? `${base}/storage/v1${signed}` : null;
  } catch {
    return null;
  }
}

export async function deleteImage(publicUrl: string): Promise<boolean> {
  if (!publicUrl || publicUrl.startsWith('data:')) return false;

  if (publicUrl.includes('/uploads/')) {
    const url = process.env.GODADDY_UPLOAD_URL;
    if (!url || !env.uploadSecret) return false;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Upload-Secret': env.uploadSecret },
        body: JSON.stringify({ action: 'delete', url: publicUrl }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  const key = supabaseKey();
  const base = supabaseUrl();
  if (!key || !base) return false;

  let bucket = '';
  let path = '';
  if (publicUrl.startsWith(PRIVATE_PREFIX)) {
    bucket = privateBucket();
    path = publicUrl.substring(PRIVATE_PREFIX.length);
  } else {
    for (const b of [publicBucket(), 'spotlight-images']) {
      const prefix = `/storage/v1/object/public/${b}/`;
      if (publicUrl.startsWith(base) && publicUrl.includes(prefix)) {
        bucket = b;
        path = publicUrl.substring(publicUrl.indexOf(prefix) + prefix.length);
        break;
      }
    }
  }
  if (!bucket || !path) return false;

  try {
    const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
