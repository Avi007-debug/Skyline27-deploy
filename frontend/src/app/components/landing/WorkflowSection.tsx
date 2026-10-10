import { useState } from "react";
import { motion } from "motion/react";
import { KeyRound, CalendarPlus, UserCheck, QrCode, CheckCircle2, Copy, Users } from "lucide-react";
import Typewriter from "./Typewriter";

const FM = "'JetBrains Mono', monospace";
const FB = "'Archivo', sans-serif";
const FC = "'Space Grotesk', sans-serif";

export default function WorkflowSection() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copyPulse, setCopyPulse] = useState(false);

  const [scanVerified, setScanVerified] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);
  const [scanKey, setScanKey] = useState(0);

  const steps = [
    {
      id: 0,
      num: "01",
      role: "CLUB SETUP",
      title: "Club Onboarding",
      summary: "A single-use key lets a verified student organization set up its club space and elect its officers.",
      accent: "from-amber-500 to-orange-500",
      textColor: "text-amber-400",
      icon: KeyRound,
      interactive: (
        <div className={`mt-4 p-3.5 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 border border-stone-200/70 dark:border-transparent text-left transition-all duration-300 ${copyPulse ? "ring-2 ring-emerald-500/50 bg-emerald-950/20" : ""}`}>
          <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 dark:text-slate-400 mb-2">
            <span>ONE-TIME AUTHORIZATION KEY</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              VALID
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-stone-900/5 dark:bg-white/5 p-2 rounded-xl">
            <span className="font-mono text-xs sm:text-sm tracking-wider text-amber-600 dark:text-amber-300 font-bold">
              SKYLINE-A89F-Q23M
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText("SKYLINE-A89F-Q23M");
                setCopiedKey(true);
                setCopyPulse(true);
                setTimeout(() => setCopyPulse(false), 800);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                copyPulse ? "bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/50" : "bg-stone-900/5 hover:bg-stone-900/10 dark:bg-white/10 dark:hover:bg-white/20 text-stone-700 dark:text-slate-200"
              }`}
              title="Copy key"
            >
              {copiedKey ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-stone-500 dark:text-slate-400 mt-2 font-mono">
            {copiedKey ? "Copied! Single-use key prevents unauthorized clubs." : "Click icon to copy authorization key."}
          </p>
        </div>
      ),
    },
    {
      id: 1,
      num: "02",
      role: "OFFICERS",
      title: "Publish & Price an Event",
      summary: "Officers create events, set member and non-member prices, cap the seats and upload the club's UPI QR.",
      accent: "from-[#4285F4] to-[#1a73e8]",
      textColor: "text-[#1a73e8] dark:text-blue-400",
      icon: CalendarPlus,
      interactive: (
        <div className="mt-4 p-3.5 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 border border-stone-200/70 dark:border-transparent text-left">
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.3, delay: 0 * 0.06 }}
              className="p-2 rounded-xl bg-stone-900/5 dark:bg-white/5"
            >
              <span className="text-stone-500 dark:text-slate-400 block text-[9px]">TYPE</span>
              <span className="text-stone-900 dark:text-white font-bold">Gala</span>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.3, delay: 1 * 0.06 }}
              className="p-2 rounded-xl bg-stone-900/5 dark:bg-white/5"
            >
              <span className="text-stone-500 dark:text-slate-400 block text-[9px]">CAP</span>
              <span className="text-stone-900 dark:text-white font-bold">120 Seats</span>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.3, delay: 2 * 0.06 }}
              className="p-2 rounded-xl bg-stone-900/5 dark:bg-white/5"
            >
              <span className="text-stone-500 dark:text-slate-400 block text-[9px]">FEE</span>
              <span className="text-[#1e8e3e] dark:text-emerald-400 font-bold truncate block">₹150 / ₹100 member</span>
            </motion.div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[10px] text-stone-600 dark:text-slate-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" />
            <span>Member pricing applies automatically at checkout</span>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      num: "03",
      role: "MEMBERS",
      title: "Join, Buy, Show Your Pass",
      summary: "Students join the club, buy tickets and merch from their phone, and show one QR Club Pass for everything.",
      accent: "from-[#EA4335] to-[#d93025]",
      textColor: "text-[#d93025] dark:text-red-400",
      icon: UserCheck,
      interactive: (
        <div className="mt-4 p-3.5 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 border border-stone-200/70 dark:border-transparent text-left">
          <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 dark:text-slate-400 mb-2">
            <span>CLUB PASS</span>
            <span className="text-[#d93025] dark:text-red-400 font-bold">ACTIVE</span>
          </div>
          <div className="flex justify-between items-center gap-1.5">
            {["S", "K", "Y", "2", "7"].map((char, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="w-8 h-9 sm:w-9 sm:h-10 rounded-xl bg-stone-900/5 dark:bg-white/5 flex items-center justify-center font-mono font-bold text-sm sm:text-base text-stone-900 dark:text-white"
              >
                {char}
              </motion.div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[10px] text-stone-600 dark:text-slate-300">
            <Users className="w-3.5 h-3.5 text-[#EA4335] dark:text-red-400" />
            <span>One QR for tickets, membership and merch pickup</span>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      num: "04",
      role: "DOOR & BOOKS",
      title: "Check In, Then Close the Books",
      summary: "Scan tickets at the door with a phone camera. Afterwards the report shows who showed up and what the event made.",
      accent: "from-[#34A853] to-[#1e8e3e]",
      textColor: "text-[#1e8e3e] dark:text-emerald-400",
      icon: QrCode,
      interactive: (
        <div className="mt-4 p-3.5 rounded-2xl bg-[#F5F2EB]/90 dark:bg-black/60 border border-stone-200/70 dark:border-transparent text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-stone-500 dark:text-slate-400">CAMERA SCANNER</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setScanPulse(true);
                setScanVerified(true);
                setScanKey((prev) => prev + 1);
                setTimeout(() => {
                  setScanPulse(false);
                }, 800);
                setTimeout(() => {
                  setScanVerified(false);
                  setScanKey((prev) => prev + 1);
                }, 2400);
              }}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                scanPulse
                  ? "bg-emerald-500/40 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/50"
                  : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30"
              }`}
            >
              {scanVerified ? "SCANNING..." : "TEST SCAN"}
            </button>
          </div>
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${scanVerified ? "bg-emerald-500/20" : "bg-stone-900/5 dark:bg-white/5"}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${scanVerified ? "bg-emerald-500 dark:bg-emerald-400" : "bg-stone-400 dark:bg-slate-400"}`} />
              <span className="font-mono text-xs text-stone-900 dark:text-white font-semibold">
                <Typewriter
                  text={scanVerified ? "ACCESS GRANTED · GATE A AUDITORIUM" : "WAITING FOR QR CODE..."}
                  triggerKey={scanKey}
                  speed={16}
                />
              </span>
            </div>
            <div className="text-[10px] font-mono text-stone-500 dark:text-slate-400 mt-1">
              {scanVerified ? "Admit 4 attendees · Checked in at 09:02 AM" : "Attendance, revenue and balance, ready at a glance"}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="workflow" className="w-full py-24 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto relative z-10" style={{ fontFamily: FB }}>
      {/* Header with Typewriter Animation */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.25 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-20"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4" style={{ fontFamily: FC }}>
          <Typewriter text="A Semester with Skyline" speed={22} />
        </h2>
        <p className="text-sm sm:text-base text-stone-600 dark:text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
          <Typewriter text="One winding path from a new student joining the club to the treasurer closing the books." speed={22} delay={250} />
        </p>
      </motion.div>

      {/* S-SHAPED WINDING ROADMAP PIPELINE */}
      <div className="relative max-w-5xl mx-auto">
        {/* Background Curving S-Road Vector (Desktop) */}
        <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
          <svg className="w-full h-full" viewBox="0 0 900 1100" fill="none">
            {/* Ambient Diffuse Road Glow */}
            <motion.path
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: false, amount: 0.1 }}
              transition={{ duration: 1.8, ease: "easeInOut" }}
              d="M 220 120 
                 C 700 120, 750 360, 680 410 
                 C 600 460, 180 430, 220 680 
                 C 250 820, 680 750, 680 940"
              stroke="rgba(66, 133, 244, 0.14)"
              strokeWidth="24"
              strokeLinecap="round"
              className="blur-md"
            />
            {/* Crisp Central Circuit Track */}
            <motion.path
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: false, amount: 0.1 }}
              transition={{ duration: 2.0, ease: "easeInOut" }}
              d="M 220 120 
                 C 700 120, 750 360, 680 410 
                 C 600 460, 180 430, 220 680 
                 C 250 820, 680 750, 680 940"
              stroke="url(#roadGradient)"
              strokeWidth="3.5"
              strokeDasharray="8 6"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="roadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4285F4" />
                <stop offset="35%" stopColor="#EA4335" />
                <stop offset="70%" stopColor="#FBBC04" />
                <stop offset="100%" stopColor="#34A853" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Roadmap Nodes along the S-Curve */}
        <div className="flex flex-col gap-14 lg:gap-24 relative z-10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLeft = idx % 2 === 0;
            const isActive = activeStep === idx;

            return (
              <div
                key={step.id}
                className={`flex flex-col ${isLeft ? "lg:flex-row" : "lg:flex-row-reverse"} items-center justify-between gap-8 lg:gap-16 w-full`}
              >
                {/* Milestone Node Card with Alternating S-Curve Slide */}
                <motion.div
                  initial={{ opacity: 0, x: isLeft ? -50 : 50, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  viewport={{ once: false, amount: 0.15 }}
                  transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -8, scale: 1.02, boxShadow: "0 25px 60px -15px rgba(0,0,0,0.25)", transition: { duration: 0.25 } }}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full lg:w-[460px] p-6 sm:p-7 rounded-3xl backdrop-blur-2xl transition-all duration-400 cursor-pointer shadow-[0_15px_35px_-10px_rgba(200,180,160,0.35)] dark:shadow-2xl border border-amber-900/10 dark:border-white/5 ${
                    isActive
                      ? "bg-[#FFFDF9] dark:bg-[#0e101a] shadow-[0_20px_50px_-10px_rgba(200,180,160,0.5)] dark:shadow-[0_0_50px_rgba(0,0,0,0.9)] scale-[1.02] border-amber-900/25 dark:border-white/15"
                      : "bg-[#FFFDF9]/95 dark:bg-[#0b0c13]/90 hover:bg-[#FFFDF9] dark:hover:bg-[#0e101a]/95 hover:border-amber-900/20 dark:hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${step.accent} flex items-center justify-center text-white shadow-lg`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono tracking-widest text-stone-500 dark:text-slate-400 uppercase block" style={{ fontFamily: FM }}>
                          <Typewriter text={step.role} speed={14} />
                        </span>
                        <span className={`text-xs font-mono font-bold tracking-wider ${step.textColor}`}>
                          PHASE {step.num}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-widest uppercase ${
                      isActive ? "bg-black/10 dark:bg-white/10 text-stone-900 dark:text-white" : "bg-black/5 dark:bg-white/5 text-stone-600 dark:text-slate-500"
                    }`}>
                      {isActive ? "ACTIVE STAGE" : "TAP TO EXPLORE"}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white mb-2 tracking-tight" style={{ fontFamily: FC }}>
                    <Typewriter text={step.title} speed={22} />
                  </h3>

                  <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 leading-relaxed" style={{ fontFamily: FB }}>
                    {step.summary}
                  </p>

                  {/* Interactive Mini-Tool Container */}
                  {step.interactive}
                </motion.div>

                {/* S-Road Milestone Checkpoint Badge */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
                  whileInView={{ scale: 1, opacity: 1, rotate: 0 }}
                  viewport={{ once: false, amount: 0.15 }}
                  transition={{ type: "spring", stiffness: 240, damping: 20, delay: idx * 0.1 }}
                  whileHover={{ scale: 1.15, rotate: 5, transition: { duration: 0.2 } }}
                  className="hidden lg:flex flex-col items-center justify-center flex-shrink-0"
                >
                  <div
                    onClick={() => setActiveStep(idx)}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-lg transition-all duration-300 cursor-pointer shadow-xl ${
                      isActive
                        ? "bg-[#4285F4] dark:bg-white text-white dark:text-black shadow-[0_0_30px_rgba(66,133,244,0.4)] dark:shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-110"
                        : "bg-[#FFFDF9] dark:bg-[#0a0b12] text-stone-600 dark:text-white/50 border border-amber-900/10 dark:border-transparent hover:text-stone-900 dark:hover:text-white"
                    }`}
                  >
                    {step.num}
                  </div>
                  <span className="text-[9px] font-mono tracking-wider text-stone-500 dark:text-slate-500 mt-2 uppercase">
                    Checkpoint
                  </span>
                </motion.div>

                {/* Spacious Counterpart Balanced Breathing Space for S-curve */}
                <div className="hidden lg:block lg:w-[460px] pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
