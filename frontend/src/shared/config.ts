const raw = String(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .replace(/\s+/g, '')
  .replace(/\/+$/, '');

/** Base URL of the SkylineOS API, always ending in /api. */
export const API_BASE = raw.endsWith('/api') ? raw : `${raw}/api`;
