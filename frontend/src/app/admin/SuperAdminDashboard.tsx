import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, Users, Building2, Calendar, FileText, Key, LogOut,
  RefreshCw, Search, ChevronRight, Shield, TrendingUp, CheckCircle2,
  XCircle, AlertCircle, Copy, Check, Trash2, Plus, MoreVertical,
  ArrowLeft, Menu, X, Eye, EyeOff, ClipboardList, BarChart3,
  UserCheck, Lock, Unlock, Globe, Archive, Edit2, Activity
} from "lucide-react";

const FC = "'Playfair Display', serif";
const F_LOGO = "'Cinzel', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

let rawBase = String((import.meta as any).env?.VITE_API_URL || "http://localhost:5000/api")
  .replace(/\s+/g, "")
  .trim()
  .replace(/\/+$/, "");
if (!rawBase.endsWith("/api")) rawBase += "/api";
const API = rawBase;

async function adminFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
      ...(opts.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Sub-Components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent = false }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/40 text-xs uppercase tracking-widest" style={{ fontFamily: FM }}>{label}</span>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/50"}`}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white mb-0.5" style={{ fontFamily: FC }}>{value}</div>
      {sub && <div className="text-xs text-white/40" style={{ fontFamily: FB }}>{sub}</div>}
    </motion.div>
  );
}

function PaginationBar({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center mt-4" style={{ fontFamily: FM }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
      >← Prev</button>
      <span className="text-xs text-white/50 px-2">Page {page} / {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
      >Next →</button>
    </div>
  );
}

// ─── Pages ─────────────────────────────────────────────────────────────────────

function OverviewPage({ token }: { token: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminFetch("/admin/stats", token)
      .then(d => setStats(d.stats))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-white/40 text-sm py-12 text-center" style={{ fontFamily: FB }}>Loading platform stats…</div>;
  if (error) return <div className="text-red-400 text-sm py-8 text-center" style={{ fontFamily: FB }}>{error}</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: FC }}>Platform Overview</h2>
        <p className="text-white/40 text-sm" style={{ fontFamily: FB }}>Real-time metrics across the entire SkylineOS platform</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={16} />} label="Students" value={stats.totalUsers} sub="Registered users" />
        <StatCard icon={<Building2 size={16} />} label="Clubs" value={stats.totalClubs} sub="Active clubs" />
        <StatCard icon={<Calendar size={16} />} label="Events" value={stats.totalEvents} sub={`${stats.upcomingEvents} upcoming`} />
        <StatCard icon={<CheckCircle2 size={16} />} label="Registrations" value={stats.totalRegistrations} sub={`${stats.confirmedRegistrations} confirmed`} accent />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp size={16} />} label="Revenue" value={`₹${stats.totalRevenue?.toLocaleString() ?? 0}`} sub="From confirmed registrations" accent />
        <StatCard icon={<Key size={16} />} label="Reg. Keys" value={stats.totalKeys} sub={`${stats.unusedKeys} unused`} />
        <StatCard icon={<Activity size={16} />} label="Pending Regs" value={stats.pendingRegistrations} sub="Awaiting approval" />
      </div>
      {stats.recentAuditLogs?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wider" style={{ fontFamily: FM }}>Recent Audit Activity</h3>
          <div className="space-y-2">
            {stats.recentAuditLogs?.slice(0, 8).map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Activity size={12} className="text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white/80 font-medium" style={{ fontFamily: FM }}>{log.action}</span>
                  <span className="text-xs text-white/40 ml-2" style={{ fontFamily: FB }}>by {log.actor?.fullName ?? "System"}</span>
                </div>
                <span className="text-[10px] text-white/30 flex-shrink-0" style={{ fontFamily: FM }}>
                  {new Date(log.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
      {/* Database Maintenance */}
      <div className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 className="text-sm font-semibold text-white/70 mb-2 uppercase tracking-wider" style={{ fontFamily: FM }}>Database Maintenance</h3>
        <p className="text-xs text-white/40 mb-4" style={{ fontFamily: FB }}>Execute administrative cleanup tasks across PostgreSQL tables.</p>
        <button
          onClick={async () => {
            try {
              const res = await adminFetch("/admin/db/clean-expired-tokens", token, { method: "POST" });
              alert(res.message || "Database maintenance complete.");
            } catch (err: any) {
              alert(err.message);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/70 hover:text-white transition-all cursor-pointer"
          style={{ fontFamily: FM }}
        >
          <RefreshCw size={13} /> Clean Expired Password Tokens
        </button>
      </div>
    </div>
  );
}

function UsersPage({ token }: { token: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (debouncedSearch) q.set("search", debouncedSearch);
    adminFetch(`/admin/users?${q}`, token)
      .then(d => { setUsers(d.items || []); setTotalPages(d.pagination?.totalPages ?? 1); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, page, debouncedSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete user "${name}"? This is permanent.`)) return;
    setDeletingId(id);
    try {
      await adminFetch(`/admin/users/${id}`, token, { method: "DELETE" });
      setActionMsg({ type: "ok", msg: `User "${name}" deleted.` });
      fetchUsers();
    } catch (e: any) {
      setActionMsg({ type: "err", msg: e.message });
    } finally {
      setDeletingId(null);
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const ROLE_COLORS: Record<string, string> = {
    SUPER_ADMIN: "bg-red-500/20 text-red-400",
    CLUB_HEAD: "bg-amber-500/20 text-amber-400",
    ADMIN: "bg-amber-500/20 text-amber-400",
    STUDENT: "bg-blue-500/20 text-blue-400",
    MEMBER: "bg-green-500/20 text-green-400",
    VOLUNTEER: "bg-purple-500/20 text-purple-400",
    TREASURER: "bg-teal-500/20 text-teal-400",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: FC }}>User Management</h2>
          <p className="text-white/40 text-sm" style={{ fontFamily: FB }}>View, search, and manage all users</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, USN…"
            className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-red-500/40 transition-all w-64"
            style={{ fontFamily: FB }}
          />
        </div>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${actionMsg.type === "ok" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`} style={{ fontFamily: FB }}>
          {actionMsg.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {actionMsg.msg}
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-sm py-8 text-center" style={{ fontFamily: FB }}>Loading users…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-8 text-center" style={{ fontFamily: FB }}>{error}</div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Name", "Email / USN", "Role", "Club", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-white/40 text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: FM }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500/30 to-red-900/30 flex items-center justify-center flex-shrink-0 text-xs text-red-400 font-bold" style={{ fontFamily: FC }}>
                          {u.fullName?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-white font-medium" style={{ fontFamily: FB }}>{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white/60 text-xs" style={{ fontFamily: FB }}>{u.email}</div>
                      {u.usn && <div className="text-white/30 text-[10px] mt-0.5" style={{ fontFamily: FM }}>{u.usn}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${ROLE_COLORS[u.role] || "bg-white/10 text-white/50"}`} style={{ fontFamily: FM }}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs" style={{ fontFamily: FB }}>{u.club?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(u.id, u.fullName)}
                        disabled={!!deletingId}
                        className="text-white/20 hover:text-red-400 transition-colors p-1 rounded cursor-pointer disabled:opacity-30"
                        title="Delete user"
                      >
                        {deletingId === u.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-white/30 text-sm" style={{ fontFamily: FB }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function KeysPage({ token }: { token: string }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const fetchKeys = useCallback(() => {
    setLoading(true);
    adminFetch(`/admin/registration-keys?page=${page}&pageSize=15`, token)
      .then(d => { setKeys(d.items || []); setTotalPages(d.pagination?.totalPages ?? 1); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, page]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setNewKey(null);
    try {
      const d = await adminFetch("/admin/registration-keys/generate", token, {
        method: "POST",
        body: JSON.stringify({ customCode: customCode.trim() || undefined }),
      });
      setNewKey(d.key);
      setCustomCode("");
      fetchKeys();
    } catch (e: any) {
      setActionMsg({ type: "err", msg: e.message });
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Delete key "${code}"?`)) return;
    try {
      await adminFetch(`/admin/registration-keys/${id}`, token, { method: "DELETE" });
      fetchKeys();
    } catch (e: any) {
      setActionMsg({ type: "err", msg: e.message });
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white" style={{ fontFamily: FC }}>Registration Keys</h2>
        <p className="text-white/40 text-sm" style={{ fontFamily: FB }}>Generate and manage club registration keys</p>
      </div>

      {/* Generate Key */}
      <div className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs text-white/50 mb-3 uppercase tracking-wider" style={{ fontFamily: FM }}>Generate New Key</p>
        <div className="flex gap-3">
          <input
            value={customCode}
            onChange={e => setCustomCode(e.target.value.toUpperCase())}
            placeholder="Custom code (optional)"
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-red-500/40 transition-all"
            style={{ fontFamily: FM }}
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            style={{ fontFamily: FB }}
          >
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            Generate
          </button>
        </div>

        <AnimatePresence>
          {newKey && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-3 rounded-xl flex items-center justify-between"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <div>
                <div className="text-xs text-green-400 mb-0.5" style={{ fontFamily: FM }}>✓ Key generated</div>
                <div className="text-white font-bold text-sm" style={{ fontFamily: FM }}>{newKey.code}</div>
              </div>
              <button
                onClick={() => handleCopy(newKey.code, newKey.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-all cursor-pointer"
                style={{ fontFamily: FM }}
              >
                {copiedId === newKey.id ? <Check size={12} /> : <Copy size={12} />}
                {copiedId === newKey.id ? "Copied!" : "Copy"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-xl text-sm ${actionMsg.type === "err" ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-green-500/10 border border-green-500/20 text-green-400"}`} style={{ fontFamily: FB }}>
          {actionMsg.msg}
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-sm py-8 text-center" style={{ fontFamily: FB }}>Loading keys…</div>
      ) : (
        <>
          <div className="space-y-2">
            {keys.map((k, i) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-white/[0.02] transition-colors"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${k.isUsed ? "bg-white/20" : "bg-green-400"}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white" style={{ fontFamily: FM }}>{k.code}</span>
                  {k.isUsed && k.usedByClub && (
                    <div className="text-xs text-white/40 mt-0.5" style={{ fontFamily: FB }}>
                      Used by {k.usedByClub.name}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${k.isUsed ? "bg-white/10 text-white/30" : "bg-green-500/15 text-green-400"}`} style={{ fontFamily: FM }}>
                    {k.isUsed ? "USED" : "ACTIVE"}
                  </span>
                  {!k.isUsed && (
                    <>
                      <button onClick={() => handleCopy(k.code, k.id)} className="p-1.5 text-white/30 hover:text-white transition-colors cursor-pointer" title="Copy">
                        {copiedId === k.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                      </button>
                      <button onClick={() => handleDelete(k.id, k.code)} className="p-1.5 text-white/20 hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
            {keys.length === 0 && <div className="text-white/30 text-sm text-center py-8" style={{ fontFamily: FB }}>No keys found</div>}
          </div>
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function EventsAdminPage({ token }: { token: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (debouncedSearch) q.set("search", debouncedSearch);
    adminFetch(`/admin/events?${q}`, token)
      .then(d => { setEvents(d.items || []); setTotalPages(d.pagination?.totalPages ?? 1); })
      .finally(() => setLoading(false));
  }, [token, page, debouncedSearch]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: FC }}>Events</h2>
          <p className="text-white/40 text-sm" style={{ fontFamily: FB }}>Browse all events across all clubs</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search events…"
            className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-red-500/40 transition-all w-56"
            style={{ fontFamily: FB }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm py-8 text-center" style={{ fontFamily: FB }}>Loading events…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl hover:bg-white/[0.025] transition-colors cursor-default"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {e.bannerUrl && (
                  <img src={e.bannerUrl} alt={e.name} className="w-full h-28 object-cover rounded-xl mb-3 opacity-80" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-white text-sm line-clamp-2" style={{ fontFamily: FC }}>{e.name}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${e.isPublished ? "bg-green-500/15 text-green-400" : "bg-white/10 text-white/40"}`} style={{ fontFamily: FM }}>
                    {e.isPublished ? "LIVE" : "DRAFT"}
                  </span>
                </div>
                <div className="text-xs text-white/40 mt-1" style={{ fontFamily: FB }}>{e.club?.name}</div>
                <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xs text-white/50" style={{ fontFamily: FM }}>
                    {new Date(e.eventDate).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-white/50" style={{ fontFamily: FM }}>
                    {e.registrationCount} registered
                  </span>
                </div>
              </motion.div>
            ))}
            {events.length === 0 && <div className="col-span-3 text-white/30 text-sm text-center py-8" style={{ fontFamily: FB }}>No events found</div>}
          </div>
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function AuditLogsPage({ token }: { token: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/admin/audit-logs?page=${page}&pageSize=20`, token)
      .then(d => { setLogs(d.items || []); setTotalPages(d.pagination?.totalPages ?? 1); })
      .finally(() => setLoading(false));
  }, [token, page]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white" style={{ fontFamily: FC }}>Audit Logs</h2>
        <p className="text-white/40 text-sm" style={{ fontFamily: FB }}>All admin actions with actor tracing</p>
      </div>
      {loading ? (
        <div className="text-white/40 text-sm py-8 text-center" style={{ fontFamily: FB }}>Loading logs…</div>
      ) : (
        <>
          <div className="space-y-1.5">
            {logs.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.02] transition-colors"
                style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Activity size={13} className="text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white/80 font-semibold" style={{ fontFamily: FM }}>{log.action}</span>
                  <span className="text-xs text-white/35 ml-2" style={{ fontFamily: FB }}>{log.entityType}</span>
                  <div className="text-[10px] text-white/30 mt-0.5" style={{ fontFamily: FB }}>by {log.actor?.fullName ?? "System"} · {log.actor?.email}</div>
                </div>
                <div className="text-[10px] text-white/25 flex-shrink-0 text-right" style={{ fontFamily: FM }}>
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </motion.div>
            ))}
            {logs.length === 0 && <div className="text-white/30 text-sm text-center py-8" style={{ fontFamily: FB }}>No audit logs</div>}
          </div>
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Navigation ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "overview",   label: "Overview",    icon: LayoutDashboard },
  { id: "users",      label: "Users",       icon: Users },
  { id: "events",     label: "Events",      icon: Calendar },
  { id: "keys",       label: "Reg. Keys",   icon: Key },
  { id: "audit",      label: "Audit Logs",  icon: ClipboardList },
] as const;

type AdminPage = typeof NAV_ITEMS[number]["id"];

// ─── Splash Screen ─────────────────────────────────────────────────────────────

function AdminSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{ background: "#060608" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeOut" } }}
    >
      {/* animated ring */}
      <motion.div
        className="relative flex items-center justify-center mb-8"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      >
        <div className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(240,61,78,0.25) 0%, transparent 70%)", width: 140, height: 140 }} />
        <motion.div
          className="w-20 h-20 rounded-2xl flex items-center justify-center relative z-10"
          style={{ background: "rgba(240,61,78,0.12)", border: "1px solid rgba(240,61,78,0.3)" }}
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          <Shield size={36} className="text-red-400" />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <div className="text-xs tracking-[0.45em] uppercase text-white/50 mb-2" style={{ fontFamily: F_LOGO }}>SKYLINEOS</div>
        <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: FC }}>Super Admin</div>
        <div className="text-sm text-white/40" style={{ fontFamily: FB }}>Initializing secure console…</div>
      </motion.div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex gap-1">
          {[0, 0.15, 0.3].map(d => (
            <motion.div
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-red-500/60"
              animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: d }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SuperAdminDashboard({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<AdminPage>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const PageComponent = () => {
    switch (page) {
      case "overview": return <OverviewPage token={token} />;
      case "users":    return <UsersPage token={token} />;
      case "events":   return <EventsAdminPage token={token} />;
      case "keys":     return <KeysPage token={token} />;
      case "audit":    return <AuditLogsPage token={token} />;
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <AdminSplash onDone={() => setShowSplash(false)} />}
      </AnimatePresence>

      <div className="min-h-screen flex bg-[#06060A] text-white overflow-hidden">
        {/* Sidebar overlay for mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ x: sidebarOpen ? 0 : -300 }}
          className="fixed top-0 left-0 h-full w-64 z-40 flex flex-col lg:relative lg:translate-x-0 lg:flex"
          style={{ background: "rgba(10,10,16,0.96)", borderRight: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(16px)" }}
        >
          {/* Brand */}
          <div className="p-6 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(240,61,78,0.15)", border: "1px solid rgba(240,61,78,0.25)" }}>
              <Shield size={18} className="text-red-400" />
            </div>
            <div>
              <div className="text-[9px] tracking-[0.35em] uppercase text-white/40" style={{ fontFamily: F_LOGO }}>SKYLINEOS</div>
              <div className="text-sm font-bold text-white" style={{ fontFamily: FC }}>Super Admin</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-white/40 hover:text-white cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const active = page === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => { setPage(item.id); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer relative"
                  style={{
                    fontFamily: FB,
                    color: active ? "white" : "rgba(255,255,255,0.45)",
                    background: active ? "rgba(240,61,78,0.12)" : "transparent",
                  }}
                  whileHover={{ x: active ? 0 : 3 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: "rgba(240,61,78,0.1)", border: "1px solid rgba(240,61,78,0.2)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <item.icon size={15} className={`relative z-10 flex-shrink-0 ${active ? "text-red-400" : ""}`} />
                  <span className="relative z-10 font-medium">{item.label}</span>
                  {active && <ChevronRight size={12} className="relative z-10 ml-auto text-red-400/60" />}
                </motion.button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              style={{ fontFamily: FB }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </motion.aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,6,10,0.8)", backdropFilter: "blur(12px)" }}>
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/50 hover:text-white transition-colors cursor-pointer">
              <Menu size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white truncate" style={{ fontFamily: FC }}>
                {NAV_ITEMS.find(n => n.id === page)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-bold" style={{ fontFamily: FM }}>
                SUPER ADMIN
              </span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <PageComponent />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}
