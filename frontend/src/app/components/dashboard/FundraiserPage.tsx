import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HeartHandshake, Plus, Sparkles, Users, Calendar, ArrowUpRight, CheckCircle2, X, Trophy, DollarSign } from "lucide-react";
import confetti from "canvas-confetti";
import { useTheme } from "../../theme";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

export interface Campaign {
  id: string;
  title: string;
  category: "Hardware & Labs" | "Events & AV" | "Community Outreach" | "Innovation";
  goal: number;
  raised: number;
  donorsCount: number;
  daysLeft: number;
  description: string;
  status: "ACTIVE" | "FUNDED" | "UPCOMING";
}

export interface Donor {
  id: string;
  name: string;
  tier: "Title Sponsor" | "Gold Patron" | "Silver Supporter" | "Student Backer";
  amount: number;
  campaignTitle: string;
  time: string;
  note?: string;
}

const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: "camp-1",
    title: "Annual Tech Fest Grand Arena Lighting & AV Rig",
    category: "Events & AV",
    goal: 100000,
    raised: 84500,
    donorsCount: 148,
    daysLeft: 12,
    description: "Upgrading auditorium projection, pro-audio arrays, and stage lighting for collegiate tech fests.",
    status: "ACTIVE",
  },
  {
    id: "camp-2",
    title: "Autonomous Rover R&D Hardware & Sensor Array",
    category: "Hardware & Labs",
    goal: 50000,
    raised: 32000,
    donorsCount: 86,
    daysLeft: 24,
    description: "Procuring LiDAR, Nvidia Jetson compute boards, and brushless motors for inter-university competition.",
    status: "ACTIVE",
  },
  {
    id: "camp-3",
    title: "Community Coding Bootcamps for High Schools",
    category: "Community Outreach",
    goal: 25000,
    raised: 25000,
    donorsCount: 74,
    daysLeft: 0,
    description: "Free Saturday workshops teaching Python and Web fundamentals to underprivileged students.",
    status: "FUNDED",
  },
];

const INITIAL_DONORS: Donor[] = [
  {
    id: "don-1",
    name: "Vikramaditya Hegde (Alumni '21)",
    tier: "Title Sponsor",
    amount: 15000,
    campaignTitle: "Grand Arena Lighting & AV Rig",
    time: "2 hours ago",
    note: "Proud of what the Skyline chapter is building. Keep raising the bar!",
  },
  {
    id: "don-2",
    name: "Apex Embedded Systems Labs",
    tier: "Gold Patron",
    amount: 10000,
    campaignTitle: "Autonomous Rover R&D",
    time: "Yesterday",
    note: "Industry grant for robotics excellence.",
  },
  {
    id: "don-3",
    name: "Dr. K. N. Sastry (Faculty Advisor)",
    tier: "Silver Supporter",
    amount: 5000,
    campaignTitle: "Community Coding Bootcamps",
    time: "3 days ago",
  },
  {
    id: "don-4",
    name: "Ananya Deshpande (Batch '25)",
    tier: "Student Backer",
    amount: 1000,
    campaignTitle: "Grand Arena Lighting & AV Rig",
    time: "4 days ago",
    note: "Can't wait for the hackathon stage!",
  },
];

export default function FundraiserPage({ club }: { club?: any }) {
  const { isDark } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [donors, setDonors] = useState<Donor[]>(INITIAL_DONORS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<Campaign["category"]>("Hardware & Labs");
  const [newGoal, setNewGoal] = useState("50000");
  const [newDays, setNewDays] = useState("30");
  const [newDesc, setNewDesc] = useState("");

  const totalRaised = campaigns.reduce((sum, c) => sum + c.raised, 0);
  const totalGoal = campaigns.reduce((sum, c) => sum + c.goal, 0);
  const totalDonors = campaigns.reduce((sum, c) => sum + c.donorsCount, 0);
  const overallPercentage = Math.round((totalRaised / (totalGoal || 1)) * 100);

  const handleSimulateContribute = (campaignId: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === campaignId) {
          const added = 1000;
          const nextRaised = c.raised + added;
          return {
            ...c,
            raised: nextRaised,
            donorsCount: c.donorsCount + 1,
            status: nextRaised >= c.goal ? "FUNDED" : c.status,
          };
        }
        return c;
      })
    );

    const targetCamp = campaigns.find((c) => c.id === campaignId);
    const newDonation: Donor = {
      id: "don-" + Date.now(),
      name: "Anonymous Campus Supporter",
      tier: "Student Backer",
      amount: 1000,
      campaignTitle: targetCamp?.title || "Club Initiative",
      time: "Just now",
      note: "Instant collegiate micro-contribution",
    };
    setDonors([newDonation, ...donors]);

    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#F03D4E", "#10b981", "#6366f1"],
    });
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: Campaign = {
      id: "camp-" + Date.now(),
      title: newTitle.trim(),
      category: newCategory,
      goal: Number(newGoal) || 50000,
      raised: 0,
      donorsCount: 0,
      daysLeft: Number(newDays) || 30,
      description: newDesc.trim() || "Campus initiative funded through student and alumni support.",
      status: "ACTIVE",
    };

    setCampaigns([created, ...campaigns]);
    setIsModalOpen(false);
    setNewTitle("");
    setNewDesc("");
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: FC, color: isDark ? "#ffffff" : "#0f172a" }}>
            Crowdfunding & Sponsorships
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1" style={{ fontFamily: FB }}>
            Channel alumni endowments, student grants, and corporate sponsorships directly into club accounts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F03D4E] hover:bg-[#d83544] text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-red-500/25 active:scale-95"
          style={{ fontFamily: FB }}
        >
          <Plus size={16} />
          <span>Launch Campaign</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Funds Mobilized</span>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            ₹{totalRaised.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Of ₹{totalGoal.toLocaleString("en-IN")} aggregate goal</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Overall Target Met</span>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-400">
            {overallPercentage}%
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(100, overallPercentage)}%` }} />
          </div>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Backers & Donors</span>
          <div className="mt-2 text-2xl font-bold font-mono" style={{ color: isDark ? "#ffffff" : "#0f172a" }}>
            {totalDonors} Patrons
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Alumni, industry & students</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Active Campaigns</span>
          <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
            {campaigns.filter((c) => c.status === "ACTIVE").length} Live
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Accepting UPI contributions</span>
        </div>
      </div>

      {/* Campaign Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: FB, color: isDark ? "#ffffff" : "#0f172a" }}>
          Active Campaigns
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const pct = Math.round((camp.raised / (camp.goal || 1)) * 100);
            return (
              <div
                key={camp.id}
                className={`p-6 rounded-3xl flex flex-col justify-between shadow-xl transition-all ${
                  isDark ? "bg-[#0b0c13] hover:bg-[#0e101a]" : "bg-white hover:shadow-2xl"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase font-semibold bg-white/5 text-slate-400">
                      {camp.category}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase font-bold px-2 py-0.5 rounded-full ${
                        camp.status === "FUNDED"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-indigo-500/20 text-indigo-300"
                      }`}
                    >
                      {camp.status === "FUNDED" ? "100% FUNDED" : `${camp.daysLeft} DAYS LEFT`}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-2 leading-snug" style={{ fontFamily: FB }}>
                    {camp.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed mb-5" style={{ fontFamily: FB }}>
                    {camp.description}
                  </p>
                </div>

                {/* Progress & Contribution */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div>
                    <div className="flex justify-between items-baseline mb-1.5 font-mono text-xs">
                      <span className="font-bold text-emerald-400 text-sm">
                        ₹{camp.raised.toLocaleString("en-IN")}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Target: ₹{camp.goal.toLocaleString("en-IN")} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-mono text-slate-400">
                      {camp.donorsCount} Backers
                    </span>

                    <button
                      onClick={() => handleSimulateContribute(camp.id)}
                      className="cursor-pointer text-xs font-mono font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition-all active:scale-95"
                    >
                      + Test ₹1,000 Support
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Donors & Sponsors Wall */}
      <div className={`p-6 sm:p-7 rounded-3xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-xl space-y-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: FB, color: isDark ? "#ffffff" : "#0f172a" }}>
              Patron & Sponsor Honor Roll
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live feed of verified alumni endowments, industry sponsors, and student contributions.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
            <Trophy size={14} />
            Verified Ledger
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {donors.map((donor) => (
            <div
              key={donor.id}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-xs" style={{ fontFamily: FB }}>
                    {donor.name}
                  </span>
                  <span
                    className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded ${
                      donor.tier === "Title Sponsor"
                        ? "bg-amber-500/20 text-amber-300 font-bold"
                        : donor.tier === "Gold Patron"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {donor.tier}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Backed: <span className="text-slate-200">{donor.campaignTitle}</span>
                </div>
                {donor.note && (
                  <p className="text-[11px] text-slate-400 italic pt-1">
                    &ldquo;{donor.note}&rdquo;
                  </p>
                )}
                <div className="text-[10px] font-mono text-slate-500">{donor.time}</div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="font-mono font-bold text-sm text-emerald-400">
                  ₹{donor.amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Launch Campaign */}
      <AnimatePresence>
        {isModalOpen && (
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
                  Launch New Fundraising Campaign
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs" style={{ fontFamily: FB }}>
                <div>
                  <label className="block text-slate-400 mb-1">Campaign Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Drone Racing Arena FPV Gate Equipment"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-red-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none"
                    >
                      <option value="Hardware & Labs" className="bg-[#0b0c13]">Hardware & Labs</option>
                      <option value="Events & AV" className="bg-[#0b0c13]">Events & AV</option>
                      <option value="Community Outreach" className="bg-[#0b0c13]">Community Outreach</option>
                      <option value="Innovation" className="bg-[#0b0c13]">Innovation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Target Goal (₹)</label>
                    <input
                      type="number"
                      required
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Campaign Duration (Days)</label>
                  <input
                    type="number"
                    value={newDays}
                    onChange={(e) => setNewDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Short Mission Pitch</label>
                  <textarea
                    rows={3}
                    placeholder="Describe how this capital elevates student research or campus experience..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none resize-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer px-5 py-2.5 rounded-xl bg-[#F03D4E] hover:bg-[#d83544] text-white text-xs font-semibold shadow-lg shadow-red-500/25"
                  >
                    Publish Campaign
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
