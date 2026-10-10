import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, Plus, Download, ArrowUpRight, ArrowDownRight, Filter, Search, CheckCircle2, Clock, X, FileText, PieChart } from "lucide-react";
import { useTheme } from "../../theme";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: "Ticket Sales" | "Merch Revenue" | "Sponsorship" | "AV & Logistics" | "Hardware / R&D" | "Prizes & Swag";
  type: "INFLOW" | "OUTFLOW";
  amount: number;
  mode: "UPI Direct" | "NetBanking" | "Cash / Spot";
  reference: string;
  status: "VERIFIED" | "APPROVED" | "PENDING AUDIT";
}

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-501",
    date: "Oct 10, 2026",
    description: "CyberHack '26 Squad Registration Batches (42 Squads)",
    category: "Ticket Sales",
    type: "INFLOW",
    amount: 63000,
    mode: "UPI Direct",
    reference: "UPI/402918847/BATCH",
    status: "VERIFIED",
  },
  {
    id: "tx-502",
    date: "Oct 09, 2026",
    description: "Hoodie & Sticker Pack Merch Pre-Order Drops",
    category: "Merch Revenue",
    type: "INFLOW",
    amount: 24500,
    mode: "UPI Direct",
    reference: "UPI/MERCH/PRE_ORD",
    status: "VERIFIED",
  },
  {
    id: "tx-503",
    date: "Oct 08, 2026",
    description: "Apex Embedded Systems Title Sponsorship Grant",
    category: "Sponsorship",
    type: "INFLOW",
    amount: 50000,
    mode: "NetBanking",
    reference: "NEFT/SBIN0029182",
    status: "APPROVED",
  },
  {
    id: "tx-504",
    date: "Oct 07, 2026",
    description: "Main Auditorium Line Array Sound Rig Rental Deposit",
    category: "AV & Logistics",
    type: "OUTFLOW",
    amount: 22000,
    mode: "NetBanking",
    reference: "TXN/AUDIO_PRO_89",
    status: "APPROVED",
  },
  {
    id: "tx-505",
    date: "Oct 06, 2026",
    description: "Hackathon Winner Cash Prizes & Trophies Escrow",
    category: "Prizes & Swag",
    type: "OUTFLOW",
    amount: 35000,
    mode: "NetBanking",
    reference: "ESCROW/WINNER_26",
    status: "APPROVED",
  },
  {
    id: "tx-506",
    date: "Oct 05, 2026",
    description: "Jetson Nano & LiPo Battery Hardware Requisitions",
    category: "Hardware / R&D",
    type: "OUTFLOW",
    amount: 14200,
    mode: "UPI Direct",
    reference: "UPI/ROBO_HW_412",
    status: "VERIFIED",
  },
  {
    id: "tx-507",
    date: "Oct 04, 2026",
    description: "Spot Registrations (Late Admissions Gate B)",
    category: "Ticket Sales",
    type: "INFLOW",
    amount: 4500,
    mode: "Cash / Spot",
    reference: "CASH/REC_089",
    status: "PENDING AUDIT",
  },
];

export default function FinancePage({ club, events = [], registrations = [] }: { club?: any; events?: any[]; registrations?: any[] }) {
  const { isDark } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [filterType, setFilterType] = useState<"ALL" | "INFLOW" | "OUTFLOW">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // New expense form
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<Transaction["category"]>("AV & Logistics");
  const [expMode, setExpMode] = useState<Transaction["mode"]>("UPI Direct");
  const [expRef, setExpRef] = useState("");

  const totalInflow = transactions
    .filter((t) => t.type === "INFLOW")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = transactions
    .filter((t) => t.type === "OUTFLOW")
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalInflow - totalOutflow;
  const netMargin = Math.round((netBalance / (totalInflow || 1)) * 100);

  const filteredTxns = transactions.filter((t) => {
    const matchesType = filterType === "ALL" || t.type === filterType;
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.reference.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleDownloadCSV = () => {
    const headers = ["ID,Date,Description,Category,Type,Amount,PaymentMode,Reference,Status\n"];
    const rows = transactions.map(
      (t) =>
        `"${t.id}","${t.date}","${t.description.replace(/"/g, '""')}","${t.category}","${t.type}",${t.amount},"${t.mode}","${t.reference}","${t.status}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Skyline_Club_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) return;

    const newTx: Transaction = {
      id: "tx-" + Date.now(),
      date: "Today",
      description: expTitle.trim(),
      category: expCategory,
      type: "OUTFLOW",
      amount: Number(expAmount) || 0,
      mode: expMode,
      reference: expRef.trim() || `EXP/${Date.now().toString().slice(-6)}`,
      status: "APPROVED",
    };

    setTransactions([newTx, ...transactions]);
    setIsExpenseModalOpen(false);
    setExpTitle("");
    setExpAmount("");
    setExpRef("");
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: FC, color: isDark ? "#ffffff" : "#0f172a" }}>
            Club Treasury & Fiscal Audit
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1" style={{ fontFamily: FB }}>
            Automated double-entry ledger verifying student ticket UPIs, merch drops, and audited club expenditures.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadCSV}
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
            }`}
            style={{ fontFamily: FB }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F03D4E] hover:bg-[#d83544] text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-red-500/25 active:scale-95"
            style={{ fontFamily: FB }}
          >
            <Plus size={16} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Current Net Treasury</span>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            ₹{netBalance.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Liquid funds ready for deployment</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Gross Inflow (Receipts)</span>
          <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
            +₹{totalInflow.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Tickets, drops & endowments</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Disbursements (Outflows)</span>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-400">
            -₹{totalOutflow.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Venue AV, hardware & prize pools</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Net Operating Margin</span>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-400">
            +{netMargin}%
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Sustainable fiscal retention</span>
        </div>
      </div>

      {/* Revenue Breakdown Strip */}
      <div className={`p-6 rounded-3xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-xl space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart size={16} className="text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: FB, color: isDark ? "#ffffff" : "#0f172a" }}>
              Capital Allocation & Revenue Sources
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">Verified by Skyline Audit Ledger</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Event Registrations</span>
              <span className="text-emerald-400 font-bold">48%</span>
            </div>
            <div className="text-base font-bold font-mono text-white">₹67,500</div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: "48%" }} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">External Sponsorships</span>
              <span className="text-cyan-400 font-bold">35%</span>
            </div>
            <div className="text-base font-bold font-mono text-white">₹50,000</div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full" style={{ width: "35%" }} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Merchandise Store</span>
              <span className="text-indigo-400 font-bold">17%</span>
            </div>
            <div className="text-base font-bold font-mono text-white">₹24,500</div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full" style={{ width: "17%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className={`p-6 sm:p-7 rounded-3xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-xl space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: FB, color: isDark ? "#ffffff" : "#0f172a" }}>
              General Ledger Transactions
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Immutable log of all club incoming UPI receipts and authorized vendor vouchers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 text-xs font-mono">
              {(["ALL", "INFLOW", "OUTFLOW"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    filterType === t
                      ? "bg-[#F03D4E] text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="relative min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none ${
                  isDark ? "bg-white/5 text-white placeholder-slate-500" : "bg-slate-100 text-slate-900"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ fontFamily: FB }}>
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-mono text-[11px]">
                <th className="pb-3 font-medium">DATE</th>
                <th className="pb-3 font-medium">DESCRIPTION</th>
                <th className="pb-3 font-medium">CATEGORY</th>
                <th className="pb-3 font-medium">METHOD / REF</th>
                <th className="pb-3 font-medium text-right">AMOUNT (₹)</th>
                <th className="pb-3 font-medium text-right">AUDIT STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTxns.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    {t.date}
                  </td>
                  <td className="py-3.5">
                    <div className="font-semibold text-white">{t.description}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{t.id}</div>
                  </td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300">
                      {t.category}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-[11px]">
                    <div className="text-slate-300">{t.mode}</div>
                    <div className="text-[10px] text-slate-500">{t.reference}</div>
                  </td>
                  <td className="py-3.5 text-right font-mono font-bold text-sm">
                    {t.type === "INFLOW" ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        +₹{t.amount.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-rose-400 inline-flex items-center gap-1">
                        -₹{t.amount.toLocaleString("en-IN")}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${
                        t.status === "VERIFIED"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : t.status === "APPROVED"
                          ? "bg-indigo-500/15 text-indigo-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Record Expense */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg p-6 sm:p-7 rounded-3xl shadow-2xl ${
                isDark ? "bg-[#0d0e17] text-white" : "bg-white text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold" style={{ fontFamily: FB }}>
                  Record Club Expenditure
                </h3>
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-4 text-xs" style={{ fontFamily: FB }}>
                <div>
                  <label className="block text-slate-400 mb-1">Expense Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stage LED Backdrop & Truss Trussing Vendor Deposit"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-red-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Category</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none"
                    >
                      <option value="AV & Logistics" className="bg-[#0b0c13]">AV & Logistics</option>
                      <option value="Hardware / R&D" className="bg-[#0b0c13]">Hardware / R&D</option>
                      <option value="Prizes & Swag" className="bg-[#0b0c13]">Prizes & Swag</option>
                      <option value="Merch Revenue" className="bg-[#0b0c13]">Merch Production</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 15000"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Payment Method</label>
                    <select
                      value={expMode}
                      onChange={(e) => setExpMode(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none"
                    >
                      <option value="UPI Direct" className="bg-[#0b0c13]">UPI Direct</option>
                      <option value="NetBanking" className="bg-[#0b0c13]">NetBanking / NEFT</option>
                      <option value="Cash / Spot" className="bg-[#0b0c13]">Cash Voucher</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Transaction UTR / Voucher Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-4029104812"
                      value={expRef}
                      onChange={(e) => setExpRef(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer px-5 py-2.5 rounded-xl bg-[#F03D4E] hover:bg-[#d83544] text-white text-xs font-semibold shadow-lg shadow-red-500/25"
                  >
                    Post to General Ledger
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
