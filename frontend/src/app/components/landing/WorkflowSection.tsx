import { useState } from "react";
import { motion } from "motion/react";
import { KeyRound, CalendarPlus, UserCheck, QrCode, CheckCircle2, Copy, Users } from "lucide-react";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

export default function WorkflowSection() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState(false);
  const [scanVerified, setScanVerified] = useState(false);

  const steps = [
    {
      id: 0,
      num: "01",
      role: "SUPERADMIN GOVERNANCE",
      title: "Club Authorization & Vetting",
      summary: "Cryptographic, single-use keys gate club onboarding to ensure only verified student organizations register.",
      accent: "from-amber-500 to-orange-500",
      textColor: "text-amber-400",
      icon: KeyRound,
      interactive: (
        <div className="mt-4 p-3.5 rounded-2xl bg-black/60 text-left">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
            <span>ONE-TIME AUTHORIZATION KEY</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              VALID
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-white/5 p-2 rounded-xl">
            <span className="font-mono text-xs sm:text-sm tracking-wider text-amber-300 font-bold">
              SKYLINE-A89F-Q23M
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText("SKYLINE-A89F-Q23M");
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
              title="Copy key"
            >
              {copiedKey ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">
            {copiedKey ? "Copied! Single-use key prevents unauthorized clubs." : "Click icon to copy authorization key."}
          </p>
        </div>
      ),
    },
    {
      id: 1,
      num: "02",
      role: "EVENT ORGANIZERS",
      title: "Publish & Rule Configuration",
      summary: "Clubs launch Solo or Squad events, set registration limits, team size boundaries, and upload their UPI QR payment codes.",
      accent: "from-indigo-500 to-blue-500",
      textColor: "text-indigo-400",
      icon: CalendarPlus,
      interactive: (
        <div className="mt-4 p-3.5 rounded-2xl bg-black/60 text-left">
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
            <div className="p-2 rounded-xl bg-white/5">
              <span className="text-slate-400 block text-[9px]">TYPE</span>
              <span className="text-white font-bold">Squad (4)</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <span className="text-slate-400 block text-[9px]">CAP</span>
              <span className="text-white font-bold">120 Seats</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <span className="text-slate-400 block text-[9px]">FEE</span>
              <span className="text-emerald-400 font-bold">₹150 UPI</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[10px] text-slate-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Automatic UTR screenshot verification active</span>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      num: "03",
      role: "STUDENT ATTENDEES",
      title: "Squad Enrollment via 5-Char Passkeys",
      summary: "Squad leaders receive a 5-character passkey. Teammates enter the code to auto-enroll into the team roster with zero form redundancy.",
      accent: "from-cyan-500 to-teal-500",
      textColor: "text-cyan-400",
      icon: UserCheck,
      interactive: (
        <div className="mt-4 p-3.5 rounded-2xl bg-black/60 text-left">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
            <span>SQUAD PASSKEY</span>
            <span className="text-cyan-300 font-bold">4 / 4 ENROLLED</span>
          </div>
          <div className="flex justify-between items-center gap-1.5">
            {["K", "9", "X", "2", "B"].map((char, i) => (
              <div
                key={i}
                className="w-8 h-9 sm:w-9 sm:h-10 rounded-xl bg-white/5 flex items-center justify-center font-mono font-bold text-sm sm:text-base text-white"
              >
                {char}
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[10px] text-slate-300">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Squad members join with 1 click across mobile & web</span>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      num: "04",
      role: "VENUE LOGISTICS",
      title: "Sub-2-Second Turnstile QR Scan",
      summary: "Organizers scan attendee QR tickets using their phone camera or laptop webcam at the auditorium entrance. Entire squads check in instantly.",
      accent: "from-emerald-500 to-green-500",
      textColor: "text-emerald-400",
      icon: QrCode,
      interactive: (
        <div className="mt-4 p-3.5 rounded-2xl bg-black/60 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-slate-400">CAMERA SCANNER</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setScanVerified(true);
                setTimeout(() => setScanVerified(false), 2400);
              }}
              className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
            >
              {scanVerified ? "SCANNING..." : "TEST SCAN"}
            </button>
          </div>
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${scanVerified ? "bg-emerald-500/20" : "bg-white/5"}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${scanVerified ? "bg-emerald-400" : "bg-slate-400"}`} />
              <span className="font-mono text-xs text-white font-semibold">
                {scanVerified ? "ACCESS GRANTED · GATE A AUDITORIUM" : "WAITING FOR QR CODE..."}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-1">
              {scanVerified ? "Admit 4 attendees · Checked in at 09:02 AM" : "Average validation time: 0.82 seconds"}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="workflow" className="w-full py-24 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto relative z-10">
      {/* Header with Repeating Scroll Animation */}
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-20"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4" style={{ fontFamily: FC }}>
          The Skyline Event Roadmap
        </h2>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
          An integrated, winding S-curve pipeline connecting campus governance, event organizers, squad enrollment, and auditorium check-in.
        </p>
      </motion.div>

      {/* S-SHAPED WINDING ROADMAP PIPELINE */}
      <div className="relative max-w-5xl mx-auto">
        {/* Background Curving S-Road Vector (Desktop) with Repeating Scroll Animation */}
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
              stroke="rgba(240, 61, 78, 0.16)"
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
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="35%" stopColor="#6366f1" />
                <stop offset="70%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Roadmap Nodes along the S-Curve */}
        <div className="flex flex-col gap-14 lg:gap-24 relative z-10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLeft = idx % 2 === 0; // Alternating left-to-right S-curve layout
            const isActive = activeStep === idx;

            return (
              <div
                key={step.id}
                className={`flex flex-col ${isLeft ? "lg:flex-row" : "lg:flex-row-reverse"} items-center justify-between gap-8 lg:gap-16 w-full`}
              >
                {/* Milestone Node Card with Repeating Scroll Animation */}
                <motion.div
                  initial={{ opacity: 0, x: isLeft ? -50 : 50, y: 30 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: false, amount: 0.15 }}
                  transition={{ duration: 0.8, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full lg:w-[460px] p-6 sm:p-7 rounded-3xl backdrop-blur-2xl transition-all duration-400 cursor-pointer shadow-2xl ${
                    isActive
                      ? "bg-[#0e101a] shadow-[0_0_50px_rgba(0,0,0,0.9)] scale-[1.02]"
                      : "bg-[#0b0c13]/90 hover:bg-[#0e101a]/95"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${step.accent} flex items-center justify-center text-white shadow-lg`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block" style={{ fontFamily: FM }}>
                          {step.role}
                        </span>
                        <span className={`text-xs font-mono font-bold tracking-wider ${step.textColor}`}>
                          PHASE {step.num}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-widest uppercase ${
                      isActive ? "bg-white/10 text-white" : "bg-white/5 text-slate-500"
                    }`}>
                      {isActive ? "ACTIVE STAGE" : "TAP TO EXPLORE"}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight" style={{ fontFamily: FB }}>
                    {step.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed" style={{ fontFamily: FB }}>
                    {step.summary}
                  </p>

                  {/* Interactive Mini-Tool Container */}
                  {step.interactive}
                </motion.div>

                {/* S-Road Milestone Checkpoint Badge with Repeating Scroll Animation */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: false, amount: 0.15 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18, delay: idx * 0.08 + 0.05 }}
                  className="hidden lg:flex flex-col items-center justify-center flex-shrink-0"
                >
                  <div
                    onClick={() => setActiveStep(idx)}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-lg transition-all duration-300 cursor-pointer shadow-xl ${
                      isActive
                        ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-110"
                        : "bg-[#0a0b12] text-white/50 hover:text-white"
                    }`}
                  >
                    {step.num}
                  </div>
                  <span className="text-[9px] font-mono tracking-wider text-slate-500 mt-2 uppercase">
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
