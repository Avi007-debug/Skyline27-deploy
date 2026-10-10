import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Users, QrCode, CreditCard, Shield, Zap } from "lucide-react";
import confetti from "canvas-confetti";
import Typewriter from "./Typewriter";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

export default function FeaturesSection() {
  const shouldReduceMotion = useReducedMotion();
  const [squadCount, setSquadCount] = useState<number>(3);
  const [memberStatus, setMemberStatus] = useState<string>("ACTIVE");
  const [memberPulse, setMemberPulse] = useState<boolean>(false);
  const [memberKey, setMemberKey] = useState<number>(0);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanPulse, setScanPulse] = useState<boolean>(false);
  const [scanKey, setScanKey] = useState<number>(0);

  const [duesStatus, setDuesStatus] = useState<"PAID" | "PENDING">("PAID");
  const [duesPulse, setDuesPulse] = useState<boolean>(false);
  const [duesKey, setDuesKey] = useState<number>(0);

  const [keyGateStatus, setKeyGateStatus] = useState<"ACTIVE" | "VERIFIED">("VERIFIED");
  const [keyGatePulse, setKeyGatePulse] = useState<boolean>(false);
  const [keyGateKey, setKeyGateKey] = useState<number>(0);

  const handleSimulateMember = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMemberPulse(true);
    setTimeout(() => setMemberPulse(false), 800);
    setSquadCount((prev) => (prev >= 3 ? 1 : prev + 1));
    setMemberStatus((prev) => (prev === "ACTIVE" ? "RENEWED" : "ACTIVE"));
    setMemberKey((prev) => prev + 1);
    confetti({
      particleCount: 20,
      spread: 45,
      origin: { y: 0.8 },
      colors: ["#F03D4E", "#818cf8", "#38bdf8"],
    });
  };

  const handleSimulateScan = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScanPulse(true);
    setIsScanning(true);
    setScanKey((prev) => prev + 1);
    setTimeout(() => {
      setIsScanning(false);
      setScanPulse(false);
      setScanKey((prev) => prev + 1);
    }, 1000);
  };

  const handleToggleDues = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDuesPulse(true);
    setTimeout(() => setDuesPulse(false), 800);
    setDuesStatus((prev) => (prev === "PAID" ? "PENDING" : "PAID"));
    setDuesKey((prev) => prev + 1);
  };

  const handleVerifyKey = (e: React.MouseEvent) => {
    e.stopPropagation();
    setKeyGatePulse(true);
    setTimeout(() => setKeyGatePulse(false), 800);
    setKeyGateStatus((prev) => (prev === "VERIFIED" ? "ACTIVE" : "VERIFIED"));
    setKeyGateKey((prev) => prev + 1);
  };

  const chipRoles = ["MEM", "VOL", "OFC"];

  return (
    <section id="features" className="w-full py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto relative z-10 overflow-hidden">
      {/* Section Header with Typewriter Animation */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.25 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4" style={{ fontFamily: FC }}>
          <Typewriter text="Built for How Clubs Actually Run" speed={22} />
        </h2>
        <p className="text-sm sm:text-base text-stone-600 dark:text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
          <Typewriter text="Try the controls below to see how Skyline handles a real semester, from sign-up to closing the books." speed={22} delay={250} />
        </p>
      </motion.div>

      {/* 4 Interactive Feature Cards with GDG Palette (Blue, Green, Yellow, Red) & Creamy Surfaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Card 1: Memberships (Interactive) - GDG Blue #4285F4 (Slides in from Left Corner) */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -140, y: 35, scale: 0.94 }}
          whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.85, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -8, scale: 1.015, boxShadow: "0 25px 60px -15px rgba(66,133,244,0.25)", transition: { duration: 0.25 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-[#4285F4]/12 via-[#4285F4]/4 to-transparent dark:from-[#4285F4]/10 dark:via-[#4285F4]/5 bg-[#FFFDF9]/95 dark:bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-[0_15px_40px_-10px_rgba(66,133,244,0.12),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-2xl dark:shadow-black/50 flex flex-col justify-between border border-amber-900/10 dark:border-white/5 hover:border-[#4285F4]/40 dark:hover:border-[#4285F4]/30"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#4285F4]/10 dark:bg-white/5 flex items-center justify-center text-[#1a73e8] dark:text-[#4285F4] shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-[#1a73e8] dark:text-blue-300 uppercase px-2.5 py-1 rounded-full bg-[#4285F4]/10 dark:bg-white/5 border border-[#4285F4]/20 dark:border-transparent" style={{ fontFamily: FM }}>
                <Typewriter text="MEMBERSHIPS" speed={14} />
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              <Typewriter text="One QR Club Pass" speed={22} />
            </h3>

            <p className="text-sm text-stone-600 dark:text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              Students sign up once, pay dues and get a QR Club Pass with live status. Perks apply automatically and renewal reminders go out before it lapses.
            </p>

            {/* Interactive Widget - Creamy Card */}
            <div className={`p-4 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 mb-4 transition-all duration-300 border border-stone-200/70 dark:border-transparent ${memberPulse ? "ring-2 ring-emerald-500/50 bg-emerald-950/20" : ""}`}>
              <div className="flex items-center justify-between text-xs font-mono text-stone-700 dark:text-slate-300 mb-2">
                <span>MEMBER PASS:</span>
                <span className="text-[#1a73e8] dark:text-blue-400 font-bold">
                  <Typewriter text={memberStatus} triggerKey={memberKey} speed={18} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex -space-x-2">
                  {chipRoles.slice(0, squadCount).map((chip, i) => (
                    <motion.div
                      key={chip}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25, delay: i * 0.06 }}
                      className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#1a73e8] flex items-center justify-center text-[9px] font-mono text-white font-bold shadow-md"
                    >
                      {chip}
                    </motion.div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSimulateMember}
                  className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-mono transition-all active:scale-95 ${
                    memberPulse
                      ? "bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/50"
                      : "bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-[#1a73e8] dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-300"
                  }`}
                >
                  + Add Member
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-stone-500 dark:text-slate-400">
            <Zap className="w-3.5 h-3.5 text-[#4285F4]" />
            <span>Check Membership in a Scan</span>
          </div>
        </motion.div>

        {/* Card 2: Event Entry (Interactive) - GDG Green #34A853 (Slides in from Right Corner) */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 140, y: 35, scale: 0.94 }}
          whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -8, scale: 1.015, boxShadow: "0 25px 60px -15px rgba(52,168,83,0.25)", transition: { duration: 0.25 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-[#34A853]/12 via-[#34A853]/4 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/5 bg-[#FFFDF9]/95 dark:bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-[0_15px_40px_-10px_rgba(52,168,83,0.12),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-2xl dark:shadow-black/50 flex flex-col justify-between border border-amber-900/10 dark:border-white/5 hover:border-[#34A853]/40 dark:hover:border-emerald-500/20"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#34A853]/10 dark:bg-white/5 flex items-center justify-center text-[#1e8e3e] dark:text-emerald-400 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <QrCode className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-[#1e8e3e] dark:text-emerald-300 uppercase px-2.5 py-1 rounded-full bg-[#34A853]/10 dark:bg-white/5 border border-[#34A853]/20 dark:border-transparent" style={{ fontFamily: FM }}>
                <Typewriter text="EVENT ENTRY" speed={14} />
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              <Typewriter text="Door Check-In, No Printed List" speed={22} />
            </h3>

            <p className="text-sm text-stone-600 dark:text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              Turn any phone or laptop camera into the door. Scan a ticket or Club Pass, see who it is and whether they're a member, and block duplicate entries.
            </p>

            {/* Interactive Widget - Creamy Card */}
            <div className={`p-4 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 mb-4 transition-all duration-300 border border-stone-200/70 dark:border-transparent ${scanPulse ? "ring-2 ring-emerald-500/50 bg-emerald-950/20" : ""}`}>
              <div className="flex items-center justify-between text-xs font-mono text-stone-700 dark:text-slate-300 mb-2">
                <span>GATE SCANNER STATUS:</span>
                <span className="text-[#1e8e3e] dark:text-emerald-400 font-bold">
                  <Typewriter text={isScanning ? "SCANNING..." : "MEMBER ✓"} triggerKey={scanKey} speed={18} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isScanning ? "bg-amber-500 dark:bg-amber-400" : "bg-[#34A853] dark:bg-emerald-400"}`} />
                  <span className="text-xs font-mono text-stone-800 dark:text-white">
                    {isScanning ? "Processing QR Hash..." : "Gate A Camera Active"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-mono transition-all active:scale-95 ${
                    scanPulse
                      ? "bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/50"
                      : "bg-[#34A853]/15 hover:bg-[#34A853]/25 text-[#1e8e3e] dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 dark:text-emerald-300"
                  }`}
                >
                  Simulate Scan
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-stone-500 dark:text-slate-400">
            <Zap className="w-3.5 h-3.5 text-[#34A853] dark:text-emerald-400" />
            <span>Scan, Verify, Admit</span>
          </div>
        </motion.div>

        {/* Card 3: Treasury (Interactive) - GDG Yellow #FBBC04 (Slides in from Left Corner) */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -140, y: 45, scale: 0.94 }}
          whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -8, scale: 1.015, boxShadow: "0 25px 60px -15px rgba(251,188,4,0.28)", transition: { duration: 0.25 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-[#FBBC04]/16 via-[#FBBC04]/5 to-transparent dark:from-amber-500/10 dark:via-amber-500/5 bg-[#FFFDF9]/95 dark:bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-[0_15px_40px_-10px_rgba(251,188,4,0.14),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-2xl dark:shadow-black/50 flex flex-col justify-between border border-amber-900/10 dark:border-white/5 hover:border-[#FBBC04]/50 dark:hover:border-amber-500/20"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#FBBC04]/15 dark:bg-white/5 flex items-center justify-center text-[#d97706] dark:text-[#FBBC04] shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <CreditCard className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-[#b45309] dark:text-amber-300 uppercase px-2.5 py-1 rounded-full bg-[#FBBC04]/15 dark:bg-white/5 border border-[#FBBC04]/30 dark:border-transparent" style={{ fontFamily: FM }}>
                <Typewriter text="TREASURY" speed={14} />
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              <Typewriter text="Every Rupee in One Ledger" speed={22} />
            </h3>

            <p className="text-sm text-stone-600 dark:text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              Dues, tickets, merch and fundraisers land in one ledger. Members pay by UPI and submit a UTR; officers approve. Volunteer expenses go through receipts and approval.
            </p>

            {/* Interactive Widget - Creamy Card */}
            <div className={`p-4 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 mb-4 transition-all duration-300 border border-stone-200/70 dark:border-transparent ${duesPulse ? "ring-2 ring-emerald-500/50 bg-emerald-950/20" : ""}`}>
              <div className="flex items-center justify-between text-xs font-mono text-stone-700 dark:text-slate-300 mb-2">
                <span>DUES #4029:</span>
                <span className={duesStatus === "PAID" ? "text-[#b45309] dark:text-[#FBBC04] font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>
                  <Typewriter text={duesStatus} triggerKey={duesKey} speed={18} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-stone-800 dark:text-slate-300 font-medium">Amount: ₹250.00</span>
                <button
                  type="button"
                  onClick={handleToggleDues}
                  className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-mono transition-all active:scale-95 ${
                    duesPulse
                      ? "bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/50"
                      : "bg-[#FBBC04]/25 hover:bg-[#FBBC04]/35 text-[#b45309] dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-300"
                  }`}
                >
                  Toggle Status
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-stone-500 dark:text-slate-400">
            <Zap className="w-3.5 h-3.5 text-[#d97706] dark:text-[#FBBC04]" />
            <span>Income, Expenses, Balance</span>
          </div>
        </motion.div>

        {/* Card 4: Governance (Interactive) - GDG Red #EA4335 (Slides in from Right Corner) */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 140, y: 45, scale: 0.94 }}
          whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.85, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -8, scale: 1.015, boxShadow: "0 25px 60px -15px rgba(234,67,53,0.25)", transition: { duration: 0.25 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-[#EA4335]/12 via-[#EA4335]/4 to-transparent dark:from-red-500/10 dark:via-red-500/5 bg-[#FFFDF9]/95 dark:bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-[0_15px_40px_-10px_rgba(234,67,53,0.12),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-2xl dark:shadow-black/50 flex flex-col justify-between border border-amber-900/10 dark:border-white/5 hover:border-[#EA4335]/40 dark:hover:border-red-500/20"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#EA4335]/10 dark:bg-white/5 flex items-center justify-center text-[#d93025] dark:text-[#EA4335] shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <Shield className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-[#d93025] dark:text-red-300 uppercase px-2.5 py-1 rounded-full bg-[#EA4335]/10 dark:bg-white/5 border border-[#EA4335]/20 dark:border-transparent" style={{ fontFamily: FM }}>
                <Typewriter text="GOVERNANCE" speed={14} />
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              <Typewriter text="Single-Use Club Keys" speed={22} />
            </h3>

            <p className="text-sm text-stone-600 dark:text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              The platform admin issues single-use keys (<span className="text-stone-900 dark:text-white font-mono font-semibold">SKYLINE-XXXX-YYYY</span>) so only real student organizations can set up a club.
            </p>

            {/* Interactive Widget - Creamy Card */}
            <div className={`p-4 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 mb-4 transition-all duration-300 border border-stone-200/70 dark:border-transparent ${keyGatePulse ? "ring-2 ring-emerald-500/50 bg-emerald-950/20" : ""}`}>
              <div className="flex items-center justify-between text-xs font-mono text-stone-700 dark:text-slate-300 mb-2">
                <span>CLUB KEY STATUS:</span>
                <span className="text-[#d93025] dark:text-red-400 font-bold">
                  <Typewriter text={keyGateStatus} triggerKey={keyGateKey} speed={18} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-stone-800 dark:text-slate-300 truncate font-semibold">SKYLINE-99F2-K10A</span>
                <button
                  type="button"
                  onClick={handleVerifyKey}
                  className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-mono transition-all active:scale-95 ${
                    keyGatePulse
                      ? "bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/50"
                      : "bg-[#EA4335]/15 hover:bg-[#EA4335]/25 text-[#d93025] dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-300"
                  }`}
                >
                  Verify Key
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-stone-500 dark:text-slate-400">
            <Zap className="w-3.5 h-3.5 text-[#EA4335] dark:text-red-400" />
            <span>Only Verified Clubs Get In</span>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
