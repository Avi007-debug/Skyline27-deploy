import { useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { QrCode, Users, CheckCircle2, RotateCcw, Copy, Check, Sparkles, MapPin, Calendar, Clock, Ticket } from "lucide-react";

const FM = "'JetBrains Mono', monospace";
const F_LOGO = "'Cinzel', serif";
const FB = "'Manrope', sans-serif";

export default function InteractiveTicketPass() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Mouse tilt physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), { stiffness: 220, damping: 22 });
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleCopyPasskey = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText("K9X2B");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 35, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.15 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col items-center select-none py-2"
      style={{ perspective: 1200 }}
    >
      {/* Mode Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-stone-900/5 dark:bg-white/[0.06] backdrop-blur-xl mb-3.5 z-20 shadow-md border border-amber-900/10 dark:border-transparent">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
          className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
            !isFlipped
              ? "bg-[#4285F4] dark:bg-[#F03D4E] text-white shadow-md shadow-blue-500/25 dark:shadow-red-500/30 font-semibold"
              : "text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white"
          }`}
        >
          <Ticket className="w-3 h-3" />
          <span>TICKET PASS</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
          className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
            isFlipped
              ? "bg-[#EA4335] dark:bg-indigo-600 text-white shadow-md shadow-red-500/25 dark:shadow-indigo-500/30 font-semibold"
              : "text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white"
          }`}
        >
          <Users className="w-3 h-3" />
          <span>SQUAD PASSKEY</span>
        </button>
      </div>

      {/* Interactive 3D Card Container */}
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped(!isFlipped)}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        whileHover={{ scale: 1.025 }}
        whileTap={{ scale: 0.985 }}
        className="relative w-[320px] sm:w-[350px] h-[460px] sm:h-[480px] rounded-3xl cursor-pointer transition-shadow duration-300"
      >
        {/* Ambient Back Glow */}
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-red-500/25 via-indigo-500/25 to-cyan-500/25 blur-2xl opacity-60 pointer-events-none" />

        {/* Outer Glass Card without harsh borders */}
        <div
          className="relative w-full h-full rounded-3xl p-6 flex flex-col justify-between overflow-hidden backdrop-blur-2xl transition-colors duration-500"
          style={{
            background: "linear-gradient(145deg, rgba(18,20,28,0.92) 0%, rgba(8,9,14,0.96) 100%)",
            boxShadow: "0 25px 60px -15px rgba(0,0,0,0.9), inset 0 1px 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Hologram Iridescent Glare Layer */}
          <motion.div
            className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
            style={{
              background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.8) 0%, rgba(139,92,246,0.4) 30%, transparent 65%)`,
            }}
          />

          {!isFlipped ? (
            /* ================= FRONT SIDE ================= */
            <div className="h-full flex flex-col justify-between relative z-10">
              {/* Header: Brand & Live Admission */}
              <div className="flex items-center justify-between pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F03D4E] to-purple-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                    <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <span className="text-[11px] tracking-[0.25em] font-bold text-white block uppercase" style={{ fontFamily: F_LOGO }}>
                      SKYLINEOS
                    </span>
                    <span className="text-[9px] tracking-wider text-slate-400 block" style={{ fontFamily: FM }}>
                      VIP PASS #0829
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                  <span className="text-[9px] font-mono tracking-wider font-semibold uppercase">VERIFIED</span>
                </div>
              </div>

              {/* Event Title & Details */}
              <div className="my-auto py-3">
                <div className="inline-flex items-center gap-1.5 text-[10px] tracking-widest text-[#F03D4E] font-semibold uppercase mb-1" style={{ fontFamily: FM }}>
                  <Sparkles className="w-3 h-3 text-[#F03D4E]" />
                  ANNUAL HACKATHON
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug mb-3" style={{ fontFamily: FB }}>
                  Skyline CyberHack '26
                </h3>

                <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]" style={{ fontFamily: FM }}>
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>OCT 28, 2026</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>09:00 AM IST</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    <span className="truncate">Main Campus Auditorium • Gate A</span>
                  </div>
                </div>
              </div>

              {/* Digital Holographic QR Ticket Stub */}
              <div className="bg-black/40 rounded-2xl p-3.5 border border-white/10 flex items-center justify-between gap-3">
                <div className="relative p-2 bg-white rounded-xl shadow-inner flex items-center justify-center">
                  {/* Stylized QR simulation */}
                  <div className="w-16 h-16 sm:w-18 sm:h-18 flex flex-col justify-between p-1 bg-white">
                    <div className="flex justify-between">
                      <div className="w-4 h-4 bg-black rounded-sm border-2 border-white" />
                      <div className="w-4 h-4 bg-black rounded-sm border-2 border-white" />
                    </div>
                    <div className="flex justify-center items-center my-auto">
                      <div className="w-2.5 h-2.5 bg-[#F03D4E] rounded-full animate-ping opacity-75" />
                    </div>
                    <div className="flex justify-between">
                      <div className="w-4 h-4 bg-black rounded-sm border-2 border-white" />
                      <div className="w-3.5 h-3.5 bg-black" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 text-left">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400" style={{ fontFamily: FM }}>
                    DOOR ADMISSION
                  </div>
                  <div className="text-xs font-bold text-white tracking-wide">
                    TEAM SQUAD (4/4)
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                    HASH: 9A-7B-F3-88
                  </div>
                </div>

                <button
                  type="button"
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 transition-colors"
                  title="Flip ticket"
                >
                  <RotateCcw className="w-4 h-4 text-slate-300" />
                </button>
              </div>

              {/* Flip Hint */}
              <div className="text-center pt-2">
                <span className="text-[9px] tracking-[0.2em] uppercase text-slate-400 hover:text-white transition-colors" style={{ fontFamily: FM }}>
                  CLICK TO REVEAL SQUAD PASSKEY ⟳
                </span>
              </div>
            </div>
          ) : (
            /* ================= BACK SIDE ================= */
            <div className="h-full flex flex-col justify-between relative z-10">
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-[10px] tracking-[0.25em] font-semibold text-slate-400 uppercase" style={{ fontFamily: FM }}>
                  SQUAD ROSTER & PASSKEY
                </span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Passkey Display Card */}
              <div className="my-auto text-center py-2">
                <span className="text-[10px] tracking-[0.2em] uppercase text-slate-400 block mb-1.5" style={{ fontFamily: FM }}>
                  5-CHAR TEAM PASSKEY
                </span>
                
                <div
                  onClick={handleCopyPasskey}
                  className="group relative inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-500/20 via-indigo-500/20 to-cyan-500/20 border border-white/20 hover:border-white/40 cursor-pointer transition-all active:scale-95 shadow-lg"
                >
                  <span className="text-2xl sm:text-3xl font-black tracking-[0.3em] text-white font-mono pl-1">
                    K9X2B
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 mt-2 font-mono">
                  {copied ? "Copied to clipboard!" : "Share with teammates to auto-enroll"}
                </p>
              </div>

              {/* Squad Members List */}
              <div className="space-y-2 bg-black/50 rounded-2xl p-3">
                <div className="flex items-center justify-between text-[11px] text-white font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold">
                      L
                    </div>
                    <span>Alex Carter (Leader)</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">ENROLLED</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                      S1
                    </div>
                    <span>Maya Lin</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">ENROLLED</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                      S2
                    </div>
                    <span>Devon Miller</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">ENROLLED</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold">
                      S3
                    </div>
                    <span>Priya Nair</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">ENROLLED</span>
                </div>
              </div>

              {/* Back Footer */}
              <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>VENUE ADMISSION READY</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Decorative Floor Reflection */}
      <div className="w-48 h-3 mt-3 rounded-full bg-indigo-500/20 blur-md pointer-events-none" />
    </motion.div>
  );
}
