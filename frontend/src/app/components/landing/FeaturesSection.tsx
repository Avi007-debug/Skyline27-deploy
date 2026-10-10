import { useState } from "react";
import { motion } from "motion/react";
import { Users, QrCode, CreditCard, Shield, Zap } from "lucide-react";
import confetti from "canvas-confetti";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

export default function FeaturesSection() {
  const [squadCount, setSquadCount] = useState<number>(3);
  const [scanSpeed, setScanSpeed] = useState<string>("0.84s");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "CONFIRMED">("CONFIRMED");
  const [keyGateStatus, setKeyGateStatus] = useState<"ACTIVE" | "VERIFIED">("VERIFIED");

  const handleSimulateSquad = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSquadCount((prev) => (prev >= 4 ? 1 : prev + 1));
    confetti({
      particleCount: 20,
      spread: 45,
      origin: { y: 0.8 },
      colors: ["#F03D4E", "#818cf8", "#38bdf8"],
    });
  };

  const handleSimulateScan = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanSpeed((Math.random() * 0.4 + 0.6).toFixed(2) + "s");
    }, 1200);
  };

  return (
    <section id="features" className="w-full py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto relative z-10">
      {/* Section Header with Repeating Scroll Animation */}
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4" style={{ fontFamily: FC }}>
          Engineered for Collegiate Precision
        </h2>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
          Test out the interactive controls below to experience how Skyline digitizes every step of a campus event.
        </p>
      </motion.div>

      {/* 4 Frameless Interactive Bento Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Feature 1: Squad Passkeys (Interactive) */}
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -6, transition: { duration: 0.2 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-2xl shadow-black/50 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-red-400 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase px-2.5 py-1 rounded-full bg-white/5" style={{ fontFamily: FM }}>
                TEAM EVENTS
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              5-Character Squad Passkeys
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              Squad leaders generate an instant 5-character passkey (<span className="text-white font-mono font-semibold">#K9X2B</span>). Teammates enter it to auto-enroll without redundant Google Forms.
            </p>

            {/* Interactive Widget */}
            <div className="p-4 rounded-2xl bg-black/60 mb-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                <span>SIMULATED SQUAD:</span>
                <span className="text-red-400 font-bold">{squadCount} / 4 MEMBERS</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex -space-x-2">
                  {Array.from({ length: squadCount }).map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-500 to-indigo-600 flex items-center justify-center text-[9px] font-mono text-white font-bold shadow-md"
                    >
                      {i === 0 ? "CAPT" : `U${i + 1}`}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSimulateSquad}
                  className="cursor-pointer px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-mono transition-all active:scale-95"
                >
                  + Add Teammate
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Instant Squad Assembly</span>
          </div>
        </motion.div>

        {/* Feature 2: Turnstile QR Scanner (Interactive) */}
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -6, transition: { duration: 0.2 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-2xl shadow-black/50 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 shadow-inner">
                <QrCode className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase px-2.5 py-1 rounded-full bg-white/5" style={{ fontFamily: FM }}>
                VENUE ADMISSION
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              Sub-2-Second Door Scanner
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              Turn any organizer laptop webcam or smartphone into a turnstile admission gate. Validates encrypted QR passes with zero spreadsheet lag.
            </p>

            {/* Interactive Widget */}
            <div className="p-4 rounded-2xl bg-black/60 mb-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                <span>GATE SCANNER STATUS:</span>
                <span className="text-emerald-400 font-bold">{isScanning ? "SCANNING..." : `SPEED: ${scanSpeed}`}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isScanning ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <span className="text-xs font-mono text-white">
                    {isScanning ? "Processing QR Hash..." : "Gate A Camera Active"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  className="cursor-pointer px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-mono transition-all active:scale-95"
                >
                  Simulate Scan
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>&lt; 2s Turnstile Check-in</span>
          </div>
        </motion.div>

        {/* Feature 3: UPI Verification (Interactive) */}
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -6, transition: { duration: 0.2 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-2xl shadow-black/50 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-cyan-400 shadow-inner">
                <CreditCard className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase px-2.5 py-1 rounded-full bg-white/5" style={{ fontFamily: FM }}>
                FINANCIAL AUDITING
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              Automated UPI Verification
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              Accept fees directly to club UPI handles. Attendees submit UTR transaction references and receipts for one-click auditing.
            </p>

            {/* Interactive Widget */}
            <div className="p-4 rounded-2xl bg-black/60 mb-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                <span>UTR #402918847291:</span>
                <span className={paymentStatus === "CONFIRMED" ? "text-cyan-400 font-bold" : "text-amber-400 font-bold"}>
                  {paymentStatus}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-300">Amount: ₹250.00</span>
                <button
                  type="button"
                  onClick={() => setPaymentStatus((prev) => (prev === "CONFIRMED" ? "PENDING" : "CONFIRMED"))}
                  className="cursor-pointer px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-mono transition-all active:scale-95"
                >
                  Toggle Verification
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Direct UPI & UTR Matching</span>
          </div>
        </motion.div>

        {/* Feature 4: Admin Key Gate (Interactive) */}
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.7, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -6, transition: { duration: 0.2 } }}
          className="group relative rounded-3xl p-8 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent bg-[#0b0c13]/90 backdrop-blur-2xl transition-all duration-300 shadow-2xl shadow-black/50 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-purple-400 shadow-inner">
                <Shield className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase px-2.5 py-1 rounded-full bg-white/5" style={{ fontFamily: FM }}>
                GOVERNANCE
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: FB }}>
              Single-Use Admin Key Gate
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed mb-6" style={{ fontFamily: FB }}>
              Superadmins issue time-bound cryptographic registration keys (<span className="text-white font-mono font-semibold">SKYLINE-XXXX-YYYY</span>) to vet authorized clubs.
            </p>

            {/* Interactive Widget */}
            <div className="p-4 rounded-2xl bg-black/60 mb-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                <span>CLUB KEY STATUS:</span>
                <span className="text-purple-400 font-bold">{keyGateStatus}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-300 truncate">SKYLINE-99F2-K10A</span>
                <button
                  type="button"
                  onClick={() => setKeyGateStatus((prev) => (prev === "VERIFIED" ? "ACTIVE" : "VERIFIED"))}
                  className="cursor-pointer px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-mono transition-all active:scale-95"
                >
                  Verify Key
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>Cryptographic Club Vetting</span>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
