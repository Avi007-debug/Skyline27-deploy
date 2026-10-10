import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  Receipt,
  FileText,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  DollarSign,
  Lock,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from '../theme';

const FC = "'Playfair Display', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

interface FinanceAppProps {
  clubId?: string;
  getToken?: () => string | null;
}

export function formatINR(paise: number = 0): string {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}

export function FinanceApp({ clubId, getToken }: FinanceAppProps) {
  const { isDark } = useTheme();
  const [subTab, setSubTab] = useState<'overview' | 'ledger' | 'claims' | 'reports' | 'audit' | 'flow'>('overview');

  // Overview Data
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Ledger Data
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerFilter, setLedgerFilter] = useState({ category: '', type: '', search: '', page: 1 });
  const [ledgerPagination, setLedgerPagination] = useState({ total: 0, totalPages: 1 });
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Claims Data
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsFilter, setClaimsFilter] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED'>('ALL');
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Audit Data
  const [auditResult, setAuditResult] = useState<any>(null);
  const [verifyingAudit, setVerifyingAudit] = useState(false);

  // Report Data
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportDateRange, setReportDateRange] = useState({ from: '', to: '' });

  const getHeaders = useCallback(() => {
    const token = getToken ? getToken() : localStorage.getItem('spotlight_token');
    const secret = localStorage.getItem('spotlight_admin_secret') || 'skyline_admin_secret_key_2026';
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      'x-admin-secret': secret,
    };
  }, [getToken]);

  const rawBase = String((import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api')
    .replace(/\s+/g, '')
    .trim()
    .replace(/\/+$/, '');
  const API_BASE = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

  // 1. Fetch Summary
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const q = clubId ? `?clubId=${encodeURIComponent(clubId)}` : '';
      const res = await fetch(`${API_BASE}/finance/summary${q}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Fetch summary error:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [API_BASE, clubId, getHeaders]);

  // 2. Fetch Ledger
  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (clubId) params.append('clubId', clubId);
      if (ledgerFilter.category) params.append('category', ledgerFilter.category);
      if (ledgerFilter.type) params.append('type', ledgerFilter.type);
      params.append('page', String(ledgerFilter.page));
      params.append('limit', '15');

      const res = await fetch(`${API_BASE}/finance/ledger?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data.entries || []);
        setLedgerPagination(data.pagination || { total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Fetch ledger error:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [API_BASE, clubId, ledgerFilter, getHeaders]);

  // 3. Fetch Claims
  const fetchClaims = useCallback(async () => {
    setLoadingClaims(true);
    try {
      const params = new URLSearchParams();
      if (clubId) params.append('clubId', clubId);
      if (claimsFilter !== 'ALL') params.append('status', claimsFilter);

      const res = await fetch(`${API_BASE}/expenses?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims || []);
      }
    } catch (err) {
      console.error('Fetch claims error:', err);
    } finally {
      setLoadingClaims(false);
    }
  }, [API_BASE, clubId, claimsFilter, getHeaders]);

  // 4. Run Audit Verification
  const runAuditVerification = useCallback(async () => {
    setVerifyingAudit(true);
    try {
      const res = await fetch(`${API_BASE}/finance/audit/verify`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuditResult(data);
      }
    } catch (err) {
      console.error('Audit verification error:', err);
    } finally {
      setVerifyingAudit(false);
    }
  }, [API_BASE, getHeaders]);

  // 5. Fetch Semester Report
  const fetchReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const params = new URLSearchParams();
      if (clubId) params.append('clubId', clubId);
      if (reportDateRange.from) params.append('from', reportDateRange.from);
      if (reportDateRange.to) params.append('to', reportDateRange.to);

      const res = await fetch(`${API_BASE}/finance/report?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReportData(data.report);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoadingReport(false);
    }
  }, [API_BASE, clubId, reportDateRange, getHeaders]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (subTab === 'ledger') fetchLedger();
    if (subTab === 'claims') fetchClaims();
    if (subTab === 'reports') fetchReport();
    if (subTab === 'audit' && !auditResult) runAuditVerification();
  }, [subTab, fetchLedger, fetchClaims, fetchReport, auditResult, runAuditVerification]);

  // Approve Claim Action
  const handleApproveClaim = async (claimId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/expenses/${claimId}/approve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        fetchClaims();
        fetchSummary();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to approve claim');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Claim Action
  const handleRejectClaim = async () => {
    if (!rejectingClaimId || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/expenses/${rejectingClaimId}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (res.ok) {
        setRejectingClaimId(null);
        setRejectionReason('');
        fetchClaims();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reject claim');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Reimburse Claim Action
  const handleReimburseClaim = async (claimId: string) => {
    if (!confirm('Reimburse this claim? This will execute an atomic OUT/EXPENSE write to the ledger.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/expenses/${claimId}/reimburse`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        fetchClaims();
        fetchSummary();
        fetchLedger();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reimburse claim');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // CSV Report Download Action
  const handleDownloadCSV = () => {
    const params = new URLSearchParams();
    if (clubId) params.append('clubId', clubId);
    if (reportDateRange.from) params.append('from', reportDateRange.from);
    if (reportDateRange.to) params.append('to', reportDateRange.to);
    window.open(`${API_BASE}/finance/report/csv?${params.toString()}`, '_blank');
  };

  const vault = summaryData?.summary || {
    totalIncomePaise: 0,
    totalExpensePaise: 0,
    netBalancePaise: 0,
    owedToVolunteersPaise: 0,
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-28 md:pb-12 text-white">
      {/* Header */}
      <div className="relative p-6 sm:p-8 rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] tracking-[0.4em] uppercase text-red-400 font-semibold" style={{ fontFamily: FM }}>FINANCE & TREASURY</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">TAMPER-EVIDENT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: FC }}>Treasurer Control Center</h1>
            <p className="text-xs text-white/50 mt-1" style={{ fontFamily: FB }}>Cryptographic ledger, volunteer expense claims queue, and semester financial reporting.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchSummary(); if (subTab === 'ledger') fetchLedger(); if (subTab === 'claims') fetchClaims(); }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
              style={{ fontFamily: FB }}
            >
              <RefreshCw size={14} className={loadingSummary || loadingLedger || loadingClaims ? "animate-spin" : ""} />
              Sync
            </button>
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F03D4E] hover:bg-[#d63545] text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              style={{ fontFamily: FB }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-1.5 mt-6 pt-4 border-t border-white/5 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Vault Overview', icon: Wallet },
            { id: 'ledger', label: 'Audited Ledger', icon: Layers },
            { id: 'claims', label: 'Claims Queue', icon: Receipt },
            { id: 'reports', label: 'Semester Reports', icon: FileText },
            { id: 'audit', label: 'Chain Audit', icon: ShieldCheck },
            { id: 'flow', label: 'Money Flow (D6)', icon: TrendingUp },
          ].map(({ id, label, icon: Icon }) => {
            const active = subTab === id;
            return (
              <button
                key={id}
                onClick={() => setSubTab(id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active ? 'bg-white/10 text-white border border-white/15 shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                style={{ fontFamily: FB }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: OVERVIEW */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 block mb-2" style={{ fontFamily: FM }}>Net Vault Balance</span>
              <p className="text-2xl font-bold text-purple-400 font-mono">{formatINR(vault.netBalancePaise)}</p>
              <span className="text-[11px] text-white/40 mt-1 block">Live reconciled closing balance</span>
            </div>
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 block mb-2" style={{ fontFamily: FM }}>Total Income (Inflows)</span>
              <p className="text-2xl font-bold text-emerald-400 font-mono">{formatINR(vault.totalIncomePaise)}</p>
              <span className="text-[11px] text-white/40 mt-1 block">Dues, tickets, merch & fundraisers</span>
            </div>
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 block mb-2" style={{ fontFamily: FM }}>Total Expenses (Outflows)</span>
              <p className="text-2xl font-bold text-red-400 font-mono">{formatINR(vault.totalExpensePaise)}</p>
              <span className="text-[11px] text-white/40 mt-1 block">Reimbursed club purchases</span>
            </div>
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 block mb-2" style={{ fontFamily: FM }}>Owed to Volunteers</span>
              <p className="text-2xl font-bold text-amber-400 font-mono">{formatINR(vault.owedToVolunteersPaise)}</p>
              <span className="text-[11px] text-white/40 mt-1 block">Approved claims pending payout</span>
            </div>
          </div>

          {/* Income & Expense Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80" style={{ fontFamily: FM }}>Revenue by Stream</h3>
              <div className="space-y-3">
                {Object.entries(summaryData?.incomeByCategory || { DUES: 0, TICKET: 0, MERCH: 0, FUNDRAISER: 0 }).map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-xs font-semibold text-white/70" style={{ fontFamily: FB }}>{cat}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{formatINR(amt as number)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80" style={{ fontFamily: FM }}>Expenses by Category</h3>
              <div className="space-y-3">
                {Object.entries(summaryData?.expensesByCategory || { EXPENSE: 0 }).map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-xs font-semibold text-white/70" style={{ fontFamily: FB }}>{cat}</span>
                    <span className="text-xs font-mono font-bold text-red-400">{formatINR(amt as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-Event Performance */}
          <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/80" style={{ fontFamily: FM }}>Per-Event Net Profit & Loss</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 font-mono">
                    <th className="pb-3">Event Name</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Revenue</th>
                    <th className="pb-3">Expenses</th>
                    <th className="pb-3 text-right">Net Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(summaryData?.eventPnL || []).map((ev: any) => (
                    <tr key={ev.eventId} className="hover:bg-white/[0.01]">
                      <td className="py-3 font-semibold text-white">{ev.name}</td>
                      <td className="py-3 text-white/50">{ev.date ? new Date(ev.date).toLocaleDateString() : 'TBD'}</td>
                      <td className="py-3 font-mono text-emerald-400">{formatINR(ev.incomePaise)}</td>
                      <td className="py-3 font-mono text-red-400">{formatINR(ev.expensePaise)}</td>
                      <td className="py-3 text-right font-mono font-bold" style={{ color: ev.netResultPaise >= 0 ? '#34d399' : '#f87171' }}>
                        {formatINR(ev.netResultPaise)}
                      </td>
                    </tr>
                  ))}
                  {(!summaryData?.eventPnL || summaryData.eventPnL.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-white/40">No event transactions recorded in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AUDITED LEDGER */}
      {subTab === 'ledger' && (
        <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: FC }}>Cryptographic Ledger Stream</h2>
              <p className="text-xs text-white/50 mt-0.5">Append-only, SHA-256 chained transaction records.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={ledgerFilter.type}
                onChange={(e) => setLedgerFilter((p) => ({ ...p, type: e.target.value, page: 1 }))}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="">All Types (IN & OUT)</option>
                <option value="IN">Inflows Only (IN)</option>
                <option value="OUT">Outflows Only (OUT)</option>
              </select>

              <select
                value={ledgerFilter.category}
                onChange={(e) => setLedgerFilter((p) => ({ ...p, category: e.target.value, page: 1 }))}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="">All Categories</option>
                <option value="DUES">DUES</option>
                <option value="TICKET">TICKET</option>
                <option value="MERCH">MERCH</option>
                <option value="FUNDRAISER">FUNDRAISER</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/40 font-mono">
                  <th className="py-3 px-3">Entry ID</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Memo</th>
                  <th className="py-3 px-3">Cryptographic Hash</th>
                  <th className="py-3 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ledgerEntries.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.01]">
                    <td className="py-3.5 px-3 font-mono text-white/60">#{row.id}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        row.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {row.type === 'IN' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold">{row.category}</td>
                    <td className="py-3.5 px-3 font-mono font-bold" style={{ color: row.type === 'IN' ? '#34d399' : '#f87171' }}>
                      {row.type === 'IN' ? '+' : '-'}{formatINR(row.amountPaise)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-white/70">{row.refType} · {row.refId}</td>
                    <td className="py-3.5 px-3 text-white/60">{row.memo || '—'}</td>
                    <td className="py-3.5 px-3 font-mono text-[10px] text-white/30 truncate max-w-[120px]" title={row.hash}>
                      {row.hash.substring(0, 10)}...{row.hash.substring(58)}
                    </td>
                    <td className="py-3.5 px-3 text-white/40">{new Date(row.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {ledgerEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-white/40">No ledger transactions found matching filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {ledgerPagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-white/50">
              <span>Showing Page {ledgerFilter.page} of {ledgerPagination.totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={ledgerFilter.page <= 1}
                  onClick={() => setLedgerFilter((p) => ({ ...p, page: p.page - 1 }))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-30 cursor-pointer"
                >Previous</button>
                <button
                  disabled={ledgerFilter.page >= ledgerPagination.totalPages}
                  onClick={() => setLedgerFilter((p) => ({ ...p, page: p.page + 1 }))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-30 cursor-pointer"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: CLAIMS QUEUE */}
      {subTab === 'claims' && (
        <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: FC }}>Volunteer Expense Claims Queue</h2>
              <p className="text-xs text-white/50 mt-0.5">Inspect receipts, approve claims, and reimburse to trigger automated ledger writes.</p>
            </div>

            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
              {(['ALL', 'SUBMITTED', 'APPROVED', 'REIMBURSED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setClaimsFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    claimsFilter === st ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {claims.map((claim) => (
              <div key={claim.id} className="p-4 sm:p-5 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">{claim.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      claim.status === 'SUBMITTED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      claim.status === 'APPROVED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      claim.status === 'REIMBURSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>{claim.status}</span>
                    {claim.mismatchFlag && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                        <AlertTriangle size={10} /> MISMATCH DETECTED
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-white/50 flex items-center gap-3 flex-wrap">
                    <span>Claimant: <strong>{claim.claimant?.fullName || 'Volunteer'}</strong></span>
                    {claim.vendor && <span>Vendor: {claim.vendor}</span>}
                    <span>Date: {new Date(claim.dateSpent).toLocaleDateString()}</span>
                  </div>

                  {claim.decisionNote && (
                    <div className="text-xs text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                      Reason: {claim.decisionNote}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-white/40 block font-mono">CLAIM AMOUNT</span>
                    <span className="text-lg font-mono font-bold text-white">{formatINR(claim.amountPaise)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {claim.receiptUrl && (
                      <button
                        onClick={() => setSelectedReceipt(claim.receiptUrl)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 cursor-pointer"
                        title="View Receipt"
                      >
                        <Eye size={16} />
                      </button>
                    )}

                    {claim.status === 'SUBMITTED' && (
                      <>
                        <button
                          disabled={actionLoading}
                          onClick={() => handleApproveClaim(claim.id)}
                          className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold cursor-pointer active:scale-95"
                        >Approve</button>
                        <button
                          disabled={actionLoading}
                          onClick={() => { setRejectingClaimId(claim.id); setRejectionReason(''); }}
                          className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold cursor-pointer active:scale-95"
                        >Reject</button>
                      </>
                    )}

                    {claim.status === 'APPROVED' && (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleReimburseClaim(claim.id)}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold cursor-pointer shadow-lg active:scale-95"
                      >Reimburse Now</button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {claims.length === 0 && (
              <div className="py-12 text-center text-white/40 text-xs">No expense claims found matching filter.</div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SEMESTER REPORTS */}
      {subTab === 'reports' && (
        <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: FC }}>Semester Financial Report</h2>
              <p className="text-xs text-white/50 mt-0.5">Authoritative statement of opening balance, income, expenses, and closing balance.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadCSV}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Download CSV
              </button>
              <button
                onClick={() => window.open(`${API_BASE}/finance/report/html`, '_blank')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F03D4E] hover:bg-[#d63545] text-white flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink size={14} /> Print / PDF View
              </button>
            </div>
          </div>

          {reportData && (
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="text-white/40 block">Opening Balance</span>
                  <span className="text-base font-bold font-mono">{formatINR(reportData.vaultSummary.openingBalancePaise)}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Total Inflows</span>
                  <span className="text-base font-bold font-mono text-emerald-400">+{formatINR(reportData.vaultSummary.totalIncomePaise)}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Total Outflows</span>
                  <span className="text-base font-bold font-mono text-red-400">-{formatINR(reportData.vaultSummary.totalExpensePaise)}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Closing Balance</span>
                  <span className="text-base font-bold font-mono text-purple-400">{formatINR(reportData.vaultSummary.closingBalancePaise)}</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <span className="font-bold uppercase tracking-wider text-white/70 block" style={{ fontFamily: FM }}>Detailed Revenue Sources</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-white/50 block text-[11px]">Membership Dues</span>
                    <span className="font-mono font-bold text-white">{formatINR(reportData.incomeBreakdown.duesCollectedPaise)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-white/50 block text-[11px]">Ticket Sales</span>
                    <span className="font-mono font-bold text-white">{formatINR(reportData.incomeBreakdown.ticketSalesPaise)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-white/50 block text-[11px]">Merchandise</span>
                    <span className="font-mono font-bold text-white">{formatINR(reportData.incomeBreakdown.merchandiseRevenuePaise)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-white/50 block text-[11px]">Fundraisers</span>
                    <span className="font-mono font-bold text-white">{formatINR(reportData.incomeBreakdown.fundraiserIncomePaise)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 5: AUDIT & INTEGRITY */}
      {subTab === 'audit' && (
        <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: FC }}>Cryptographic Chain Audit Inspector</h2>
              <p className="text-xs text-white/50 mt-0.5">Every transaction is SHA-256 hashed and linked to its predecessor.</p>
            </div>

            <button
              disabled={verifyingAudit}
              onClick={runAuditVerification}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-black flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={verifyingAudit ? "animate-spin" : ""} />
              Re-Verify Whole Chain
            </button>
          </div>

          {auditResult && (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 size={18} />
                <span>CRYPTOGRAPHIC LEDGER INTEGRITY: VERIFIED INTACT</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-white/80">
                <div>
                  <span className="text-white/40 block">Total Verified Transactions:</span>
                  <span className="text-lg font-bold text-white">{auditResult.entryCount}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Current Head Hash:</span>
                  <span className="text-xs text-emerald-300 break-all">{auditResult.headHash}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 6: D6 MONEY FLOW VISUALIZATION */}
      {subTab === 'flow' && (
        <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/5 space-y-6">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: FC }}>Money-Flow Visualization (D6)</h2>
            <p className="text-xs text-white/50 mt-0.5">Interactive flow of dues, tickets, merchandise and fundraiser income through the vault.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Sources */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider text-white/40 font-mono block">1. Revenue Sources</span>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-white/60 block">Membership Dues</span>
                <span className="font-mono font-bold text-emerald-400">{formatINR(summaryData?.incomeByCategory?.DUES || 0)}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-white/60 block">Ticket Sales</span>
                <span className="font-mono font-bold text-emerald-400">{formatINR(summaryData?.incomeByCategory?.TICKET || 0)}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-white/60 block">Merchandise</span>
                <span className="font-mono font-bold text-emerald-400">{formatINR(summaryData?.incomeByCategory?.MERCH || 0)}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-white/60 block">Fundraisers</span>
                <span className="font-mono font-bold text-emerald-400">{formatINR(summaryData?.incomeByCategory?.FUNDRAISER || 0)}</span>
              </div>
            </div>

            {/* Central Vault */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/20 text-center space-y-2">
              <span className="text-[11px] uppercase tracking-widest text-purple-400 font-mono">Central Vault</span>
              <div className="text-3xl font-mono font-bold text-white">{formatINR(vault.netBalancePaise)}</div>
              <p className="text-[11px] text-white/40">Reconciled Net Reserve</p>
            </div>

            {/* Outflows */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider text-white/40 font-mono block">2. Expenditures & Liabilities</span>
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs">
                <span className="text-white/60 block">Reimbursed Expenses</span>
                <span className="font-mono font-bold text-red-400">{formatINR(vault.totalExpensePaise)}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <span className="text-white/60 block">Owed to Volunteers</span>
                <span className="font-mono font-bold text-amber-400">{formatINR(vault.owedToVolunteersPaise)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-5 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Proof Receipt</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-white/50 hover:text-white cursor-pointer"><XCircle size={18} /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl">
              <img src={selectedReceipt} alt="Receipt proof" className="w-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingClaimId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-5 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-red-400">Reject Expense Claim</h3>
            <p className="text-xs text-white/60">A rejection reason is mandatory and will be logged in the audit trail.</p>
            <textarea
              rows={3}
              placeholder="e.g. Ineligible category or missing VAT receipt"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500/40"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectingClaimId(null)} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/60">Cancel</button>
              <button
                disabled={!rejectionReason.trim() || actionLoading}
                onClick={handleRejectClaim}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white disabled:opacity-50"
              >Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FinanceApp;
