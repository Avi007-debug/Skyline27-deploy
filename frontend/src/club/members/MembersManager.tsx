import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Check, Clock, Search, Settings2, UserCheck, X } from "lucide-react";
import { request, sanitizeErrorMessage } from "../api";

const FM = "var(--sk-font)";
const FB = "var(--sk-font)";

type State = "" | "pending" | "active" | "expiring" | "expired" | "rejected";
interface Row {
  id: string; status: "PENDING" | "ACTIVE" | "REJECTED"; state: string; startDate: string | null; endDate: string | null;
  duesPaidPaise: number; transactionId: string | null; createdAt: string;
  user: { id: string; fullName: string; email: string; usn: string | null; branch: string | null; phone: string | null };
}
interface Summary { activeMembers: number; expiringSoon: number; pendingPayments: number; settings: { membershipFeePaise: number; membershipMonths: number } | null }
interface Pagination { page: number; pageSize: number; totalItems: number; totalPages: number }

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

const STATE_TABS: Array<[State, string]> = [["pending", "Needs review"], ["active", "Active"], ["expiring", "Expiring soon"], ["expired", "Expired"], ["", "All"]];

interface Props { clubId?: string; getToken: () => Promise<string | null>; isDark: boolean }

/**
 * Membership for the signed-in club: set the dues, verify the payments students submit (which also
 * records the dues in the treasury), and see who is an active member. The server scopes every call
 * to this club.
 */
export default function MembersManager({ getToken, isDark }: Props) {
  const text = "var(--sk-fg)";
  const sub = "var(--sk-muted)";
  const card = { background: "var(--sk-surface)", border: "1px solid var(--sk-line)" } as const;
  const field = { background: "var(--sk-raised)", border: "1px solid var(--sk-line)", color: text } as const;

  const [state, setState] = useState<State>("pending");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fee, setFee] = useState("");
  const [months, setMonths] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const call = useCallback(async (path: string, init: RequestInit = {}) => request(path, init, (await tokenRef.current()) ?? undefined), []);

  const loadSummary = useCallback(async () => {
    try {
      const s: Summary = await call("/memberships/manage/summary");
      setSummary(s);
      if (s.settings) {
        setFee(String(s.settings.membershipFeePaise / 100));
        setMonths(String(s.settings.membershipMonths));
      }
    } catch { /* the list below reports errors */ }
  }, [call]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: "10", ...(state ? { state } : {}), ...(search ? { search } : {}) });
      const data = await call(`/memberships/manage?${q}`);
      setRows(data.items);
      setPagination(data.pagination);
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not load members."));
    } finally {
      setLoading(false);
    }
  }, [call, page, state, search]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const act = async (id: string, action: "verify" | "reject") => {
    setBusy(id);
    setNotice(null);
    setError(null);
    try {
      await call(`/memberships/manage/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      setNotice(action === "verify" ? "Membership activated and the dues were added to the treasury." : "Payment rejected and the student was told.");
      await Promise.all([loadRows(), loadSummary()]);
    } catch (e) {
      setError(sanitizeErrorMessage(e, "That did not work."));
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setNotice(null);
    setError(null);
    try {
      const rupeesValue = Number(fee);
      if (!Number.isFinite(rupeesValue) || rupeesValue < 0) throw new Error("Dues must be 0 or more.");
      await call("/memberships/manage/settings", {
        method: "PUT",
        body: JSON.stringify({ membershipFeePaise: Math.round(rupeesValue * 100), membershipMonths: Number(months) }),
      });
      setNotice("Membership settings saved.");
      await loadSummary();
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not save the settings."));
    } finally {
      setSavingSettings(false);
    }
  };

  const stats: Array<[string, number | string, typeof BadgeCheck]> = [
    ["Active members", summary?.activeMembers ?? "—", BadgeCheck],
    ["Expiring in 7 days", summary?.expiringSoon ?? "—", Clock],
    ["Payments to review", summary?.pendingPayments ?? "—", UserCheck],
  ];

  return (
    <div className="p-4 sm:p-8 space-y-6" style={{ fontFamily: FB }}>
      <div>
        <p className="text-[11px] tracking-normal mb-1.5" style={{ color: sub, fontFamily: FM }}>Club membership</p>
        <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: text }}>Members</h1>
      </div>

      {notice && <div role="status" className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>{notice}</div>}
      {error && <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, var(--sk-danger) 12%, transparent)", color: "var(--sk-danger)" }}>{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3" style={card}>
            <Icon size={20} style={{ color: "var(--sk-brand)" }} />
            <div>
              <div className="text-2xl font-semibold" style={{ color: text }}>{value}</div>
              <div className="text-xs" style={{ color: sub }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl p-4 sm:p-5" style={card} aria-label="Membership dues">
        <h2 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: text }}><Settings2 size={15} /> Dues</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs" style={{ color: sub }}>
            Dues per period (₹, 0 = free)
            <input type="number" min={0} value={fee} onChange={e => setFee(e.target.value)} className="block mt-1 w-40 rounded-xl px-3 py-2 text-sm outline-none" style={field} />
          </label>
          <label className="text-xs" style={{ color: sub }}>
            Period (months)
            <input type="number" min={1} max={60} value={months} onChange={e => setMonths(e.target.value)} className="block mt-1 w-28 rounded-xl px-3 py-2 text-sm outline-none" style={field} />
          </label>
          <button onClick={saveSettings} disabled={savingSettings} className="px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: "var(--sk-brand)" }}>
            {savingSettings ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: sub }}>
          Students pay by UPI to your club's QR code / UPI ID (set in Settings) and submit the reference. Verified dues appear in Finance as "Dues".
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {STATE_TABS.map(([id, label]) => (
          <button key={label} onClick={() => { setState(id); setPage(1); }} className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
            style={{ background: state === id ? "var(--sk-fg)" : "var(--sk-surface)", color: state === id ? "var(--sk-canvas)" : sub, border: state === id ? "1px solid var(--sk-fg)" : "1px solid var(--sk-line)" }}>
            {label}
          </button>
        ))}
        <div className="relative max-w-xs w-full ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search name, email or USN" aria-label="Search members"
            className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none" style={field} />
        </div>
      </div>

      <div className="rounded-xl overflow-x-auto" style={card}>
        <table className="w-full text-sm" style={{ color: text, minWidth: 640 }}>
          <thead>
            <tr className="text-left text-xs" style={{ color: sub, fontFamily: FM }}>
              <th className="p-3">Student</th><th className="p-3">Status</th><th className="p-3">Period</th><th className="p-3">Dues</th><th className="p-3">Reference</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center" style={{ color: sub }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center" style={{ color: sub }}>{state === "pending" ? "No payments waiting for review." : "No members here yet."}</td></tr>}
            {!loading && rows.map(r => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--sk-line)" }}>
                <td className="p-3">
                  <div className="font-semibold">{r.user.fullName}</div>
                  <div className="text-xs" style={{ color: sub }}>{r.user.usn || r.user.email}</div>
                </td>
                <td className="p-3">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{
                    background: r.state === "ACTIVE" ? "rgba(16,185,129,0.15)" : r.state === "PENDING" ? "rgba(245,158,11,0.15)" : "rgba(148,163,184,0.18)",
                    color: r.state === "ACTIVE" ? "#10b981" : r.state === "PENDING" ? "#f59e0b" : sub,
                  }}>{r.state}</span>
                </td>
                <td className="p-3 text-xs" style={{ color: sub }}>{r.startDate ? `${day(r.startDate)} → ${day(r.endDate)}` : `Submitted ${day(r.createdAt)}`}</td>
                <td className="p-3">{rupees(r.duesPaidPaise)}</td>
                <td className="p-3 text-xs" style={{ fontFamily: FM }}>{r.transactionId || "—"}</td>
                <td className="p-3">
                  {r.status === "PENDING" && (
                    <div className="flex gap-2 justify-end">
                      <button disabled={busy === r.id} onClick={() => act(r.id, "verify")} aria-label={`Verify payment from ${r.user.fullName}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: "#10b981" }}><Check size={13} /> Verify</button>
                      <button disabled={busy === r.id} onClick={() => act(r.id, "reject")} aria-label={`Reject payment from ${r.user.fullName}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60" style={{ background: "color-mix(in srgb, var(--sk-danger) 12%, transparent)", color: "var(--sk-danger)" }}><X size={13} /> Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-xs" style={{ fontFamily: FM, color: sub }}>
          <button disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} className="px-3 py-1.5 rounded-full border border-white/10 disabled:opacity-40 cursor-pointer">Prev</button>
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)} className="px-3 py-1.5 rounded-full border border-white/10 disabled:opacity-40 cursor-pointer">Next</button>
        </div>
      )}
    </div>
  );
}
