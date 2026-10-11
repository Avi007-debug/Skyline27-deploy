import { useState } from "react";
import { Archive, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import {
  closeEventRegistration,
  deleteEvent,
  reopenEventRegistration,
  sanitizeErrorMessage,
  setEventPublished,
} from "../api";

const FB = "'Manrope', sans-serif";

interface Props {
  event: any;
  isDark: boolean;
  getToken: () => Promise<string | null>;
  /** Re-fetch the club's events/counters after any change. */
  onChanged: () => Promise<void> | void;
  /** The event no longer exists (deleted), so the detail view should close. */
  onGone: () => void;
}

type Action = "close" | "reopen" | "publish" | "unpublish" | "delete";

const COPY: Record<Action, { title: string; body: string; confirm: string; danger?: boolean }> = {
  close: {
    title: "Close registration?",
    body: "New registrations stop immediately. The event stays visible to students with a \"registration closed\" label. You can reopen it at any time.",
    confirm: "Close registration",
  },
  reopen: {
    title: "Reopen registration?",
    body: "Students can register again (subject to the event dates and capacity).",
    confirm: "Reopen",
  },
  publish: { title: "Publish this event?", body: "It becomes visible to everyone on the student app and website.", confirm: "Publish" },
  unpublish: {
    title: "Unpublish this event?",
    body: "It is hidden from students. Existing registrations are kept.",
    confirm: "Unpublish",
    danger: true,
  },
  delete: {
    title: "Delete this event?",
    body: "If students have registered, the event is archived instead of erased so registrations and payment history stay intact. Events with no registrations are removed.",
    confirm: "Delete event",
    danger: true,
  },
};

/** Close/reopen registration, publish/unpublish and delete for one event, each with an explicit confirmation. */
export default function EventControls({ event, isDark, getToken, onChanged, onGone }: Props) {
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const closed = !!event.registrationClosedManually;
  const published = event.isPublished !== false;

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const token = (await getToken()) ?? undefined;
      let message = "";
      if (pending === "close") message = (await closeEventRegistration(event.id, token)).message;
      else if (pending === "reopen") message = (await reopenEventRegistration(event.id, token)).message;
      else if (pending === "publish") message = (await setEventPublished(event.id, true, token)).message;
      else if (pending === "unpublish") message = (await setEventPublished(event.id, false, token)).message;
      else {
        const res = await deleteEvent(event.id, token);
        message = res.message;
        await onChanged();
        setPending(null);
        onGone();
        return;
      }
      setNotice(message);
      await onChanged();
      setPending(null);
    } catch (e) {
      setError(sanitizeErrorMessage(e, "That did not work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const btn = (label: string, icon: React.ReactNode, action: Action, danger = false) => (
    <button
      key={action}
      type="button"
      onClick={() => { setError(null); setNotice(null); setPending(action); }}
      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
      style={{
        fontFamily: FB,
        background: danger ? "rgba(240,61,78,0.08)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        border: danger ? "1px solid rgba(240,61,78,0.3)" : isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
        color: danger ? "#F03D4E" : isDark ? "#e5e7eb" : "#334155",
      }}
    >
      {icon} {label}
    </button>
  );

  const copy = pending ? COPY[pending] : null;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {closed ? btn("Reopen registration", <Unlock size={13} />, "reopen") : btn("Close registration", <Lock size={13} />, "close")}
        {published ? btn("Unpublish", <EyeOff size={13} />, "unpublish") : btn("Publish", <Eye size={13} />, "publish")}
        {btn("Delete", <Archive size={13} />, "delete", true)}
        {closed && (
          <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase tracking-wider">
            Registration closed
          </span>
        )}
        {!published && (
          <span className="text-[10px] px-2 py-1 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 font-bold uppercase tracking-wider">
            Draft · hidden
          </span>
        )}
      </div>
      {notice && <p role="status" className="mt-2 text-xs text-emerald-500" style={{ fontFamily: FB }}>{notice}</p>}

      {copy && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }} role="dialog" aria-modal="true">
          <div className="w-full max-w-md p-7 rounded-3xl" style={{ background: isDark ? "#0c0c0c" : "#f0f2f6", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.12)" }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: isDark ? "#fff" : "#1e1b26", fontFamily: FB }}>{copy.title}</h2>
            <p className="text-sm mb-5" style={{ color: isDark ? "#a1a1aa" : "#475569", fontFamily: FB }}>{copy.body}</p>
            {error && <p role="alert" className="text-xs text-[#F03D4E] mb-4">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setPending(null)} disabled={busy} className="px-5 py-2 text-xs rounded-full font-semibold cursor-pointer" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0", color: isDark ? "#fff" : "#334155" }}>
                Cancel
              </button>
              <button onClick={run} disabled={busy} className="px-5 py-2 text-xs rounded-full font-semibold text-white cursor-pointer disabled:opacity-50" style={{ background: "#F03D4E" }}>
                {busy ? "Working…" : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
