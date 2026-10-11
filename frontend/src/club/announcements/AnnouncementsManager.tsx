import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { request, sanitizeErrorMessage } from "../api";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

type Category = "GENERAL" | "MEETING" | "DEADLINE";
interface Item { id: string; title: string; content: string; category: Category; createdAt: string; author: { id: string; fullName: string } | null }

const CATEGORY_LABEL: Record<Category, string> = { GENERAL: "General update", MEETING: "Meeting", DEADLINE: "Deadline" };
const CATEGORY_COLOR: Record<Category, string> = { GENERAL: "#94a3b8", MEETING: "#3b82f6", DEADLINE: "#F03D4E" };

interface Props { clubId?: string; getToken: () => Promise<string | null>; isDark: boolean }

/** The club's official announcement feed: post an update (members are notified) and review the history. */
export default function AnnouncementsManager({ clubId, getToken, isDark }: Props) {
  const text = isDark ? "#fff" : "#1e1b26";
  const sub = isDark ? "#94a3b8" : "#64748b";
  const card = { background: isDark ? "rgba(255,255,255,0.015)" : "#ffffff", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)" } as const;
  const field = { background: isDark ? "rgba(255,255,255,0.03)" : "#e9ecf2", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", color: text } as const;

  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("GENERAL");
  const [posting, setPosting] = useState(false);

  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const call = useCallback(async (path: string, init: RequestInit = {}) => request(path, init, (await tokenRef.current()) ?? undefined), []);

  const load = useCallback(async (p: number) => {
    if (!clubId) return;
    setLoading(true);
    try {
      const data = await call(`/announcements/club/${clubId}?page=${p}&pageSize=10`);
      setItems(prev => (p === 1 ? data.items : [...prev, ...data.items]));
      setPage(p);
      setPages(data.pagination.totalPages);
      setError(null);
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not load announcements."));
    } finally {
      setLoading(false);
    }
  }, [call, clubId]);

  useEffect(() => { load(1); }, [load]);

  const post = async () => {
    if (!clubId) return;
    setPosting(true);
    setNotice(null);
    setError(null);
    try {
      await call(`/announcements/club/${clubId}`, { method: "POST", body: JSON.stringify({ title, content, category }) });
      setTitle("");
      setContent("");
      setCategory("GENERAL");
      setNotice("Posted. Active members have been notified.");
      await load(1);
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not post the announcement."));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    setNotice(null);
    try {
      await call(`/announcements/${id}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not delete the announcement."));
    }
  };

  const ready = title.trim().length > 0 && content.trim().length > 0;

  return (
    <div className="p-4 sm:p-8 space-y-6" style={{ fontFamily: FB }}>
      <div>
        <p className="text-[11px] tracking-[0.5em] uppercase mb-1.5" style={{ color: sub, fontFamily: FM }}>Broadcast</p>
        <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: text }}>Announcements</h1>
      </div>

      {notice && <div role="status" className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>{notice}</div>}
      {error && <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(240,61,78,0.12)", color: "#F03D4E" }}>{error}</div>}

      <section className="rounded-2xl p-4 sm:p-5 space-y-3" style={card} aria-label="New announcement">
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: text }}><Megaphone size={15} /> New announcement</h2>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={140} placeholder="Title (e.g. Weekly meeting)" aria-label="Title" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={field} />
        <textarea value={content} onChange={e => setContent(e.target.value)} maxLength={5000} rows={4} placeholder="Agenda, details, links…" aria-label="Message" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-y" style={field} />
        <div className="flex flex-wrap items-center gap-3">
          <select value={category} onChange={e => setCategory(e.target.value as Category)} aria-label="Category" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={field}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <button onClick={post} disabled={!ready || posting} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50" style={{ background: "#F03D4E" }}>
            <Send size={14} /> {posting ? "Posting…" : "Post to members"}
          </button>
        </div>
      </section>

      <section aria-label="Past announcements" className="space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: text }}>History</h2>
        {!loading && items.length === 0 && <p className="text-sm" style={{ color: sub }}>Nothing posted yet.</p>}
        {items.map(a => (
          <article key={a.id} className="rounded-2xl p-4" style={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: CATEGORY_COLOR[a.category], fontFamily: FM }}>{CATEGORY_LABEL[a.category]}</span>
                  <time className="text-xs" style={{ color: sub }} dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                  {a.author && <span className="text-xs" style={{ color: sub }}>· {a.author.fullName}</span>}
                </div>
                <h3 className="font-semibold" style={{ color: text }}>{a.title}</h3>
                <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: sub, overflowWrap: "anywhere" }}>{a.content}</p>
              </div>
              <button onClick={() => remove(a.id)} aria-label={`Delete announcement ${a.title}`} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ color: "#F03D4E" }}><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
        {page < pages && (
          <button onClick={() => load(page + 1)} disabled={loading} className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ ...field }}>{loading ? "Loading…" : "Show older"}</button>
        )}
      </section>
    </div>
  );
}
