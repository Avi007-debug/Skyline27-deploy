import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { useTheme, ThemeToggle } from "../../theme";
import { fetchPublicStats } from "../../api";
import LiveActivityTicker from "./LiveActivityTicker";
import InteractiveTicketPass from "./InteractiveTicketPass";
import FeaturesSection from "./FeaturesSection";
import WorkflowSection from "./WorkflowSection";
import EcosystemSection from "./EcosystemSection";
import ShutterGlyphFooter from "@/components/ui/shutter-glyph-footer";
import Typewriter from "./Typewriter";

const FC = "'Space Grotesk', sans-serif";
const F_LOGO = "'Cinzel', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Archivo', sans-serif";

function InViewStatCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const shouldReduceMotion = useReducedMotion();
  const [count, setCount] = useState(shouldReduceMotion ? target : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setCount(target);
      return;
    }
    if (!isInView) return;
    let frame = 0;
    const total = 45;
    const id = setInterval(() => {
      frame++;
      setCount(Math.round(target * Math.min(frame / total, 1)));
      if (frame >= total) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [isInView, target, shouldReduceMotion]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function LandingPage({ onEnter, onRegister }: { onEnter: () => void; onRegister: () => void }) {
  const { theme, isDark } = useTheme();
  const [scrollY, setScrollY] = useState(0);
  const [stats, setStats] = useState({
    liveEvents: 0,
    registrations: 0,
    clubs: 0,
    totalEvents: 0,
    totalStudents: 0
  });
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'contact' | null>(null);

  useEffect(() => {
    fetchPublicStats().then(data => {
      setStats({
        liveEvents: data.liveEvents || 0,
        registrations: data.registrations || 0,
        clubs: data.clubs || 0,
        totalEvents: data.totalEvents || 0,
        totalStudents: data.totalStudents || 0
      });
    }).catch(e => console.error("Failed to fetch public stats", e));
  }, []);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("top-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setScrolled(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div id="ls" className="min-h-screen w-full flex flex-col relative bg-background transition-colors duration-300 overflow-x-hidden" style={{ fontFamily: FB }}>
      <div id="top-sentinel" className="absolute top-0 left-0 w-full h-10 pointer-events-none z-0" />

      <nav className="fixed top-0 left-0 right-0 z-30 transition-all duration-500"
        style={{
          background: scrolled ? (isDark ? "rgba(5,5,5,0.92)" : "rgba(250,248,245,0.92)") : (isDark ? "rgba(5,5,5,0.2)" : "rgba(250,248,245,0.65)"),
          backdropFilter: scrolled ? "blur(20px)" : "blur(8px)",
          WebkitBackdropFilter: scrolled ? "blur(20px)" : "blur(8px)",
          borderBottom: scrolled ? (isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(120,100,80,0.12)") : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src="/logo.png" alt="SkylineOS Logo" className="h-8 sm:h-10 w-auto object-contain" />
            <span className="text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.3em] font-semibold whitespace-nowrap transition-colors" style={{ fontFamily: F_LOGO, color: isDark ? "#ffffff" : "#1c1917" }}>SkylineOS</span>
          </div>

          {/* Navigation Links for Smooth Scrolling */}
          <div className="hidden md:flex items-center gap-7 text-xs font-medium text-stone-600 dark:text-slate-300" style={{ fontFamily: FB }}>
            <a href="#features" className="hover:text-stone-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-stone-900 dark:hover:text-white transition-colors">Workflow</a>
            <a href="#ecosystem" className="hover:text-stone-900 dark:hover:text-white transition-colors">Ecosystem</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button onClick={onRegister}
              className="text-xs sm:text-sm px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-400 cursor-pointer active:scale-95 font-medium border border-amber-900/15 dark:border-white/10 hover:border-amber-900/30 dark:hover:border-white/20 bg-stone-900/5 hover:bg-stone-900/10 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white hidden sm:block"
            >Register Club</button>
            <button onClick={onEnter}
              className="text-xs sm:text-sm px-4 sm:px-5 py-1.5 sm:py-2 rounded-full transition-all duration-400 cursor-pointer active:scale-95 font-semibold bg-[#4285F4] hover:bg-[#1a73e8] dark:bg-[#F03D4E] dark:hover:bg-[#d83544] text-white shadow-md shadow-blue-500/25 dark:shadow-red-500/25"
            >Sign In</button>
          </div>
        </div>
      </nav>

      {/* Cinematic Dual Stadium Volumetric Spotlights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Left Sweeping Spotlight */}
        <div style={{
          position: "absolute", top: "-15%", left: "20%",
          transform: "translateX(-50%)",
          width: "600px", height: "1000px",
          background: isDark
            ? "conic-gradient(from 160deg at 50% 0%, transparent 0deg, rgba(99, 102, 241, 0.07) 12deg, transparent 24deg)"
            : "conic-gradient(from 160deg at 50% 0%, transparent 0deg, rgba(222, 63, 15, 0.05) 12deg, transparent 24deg)",
          filter: "blur(50px)",
          animation: "beamSweep 14s ease-in-out infinite",
        }} />
        {/* Right Sweeping Spotlight */}
        <div style={{
          position: "absolute", top: "-15%", right: "15%",
          transform: "translateX(50%)",
          width: "650px", height: "1000px",
          background: isDark
            ? "conic-gradient(from 190deg at 50% 0%, transparent 0deg, rgba(244, 63, 94, 0.06) 14deg, transparent 28deg)"
            : "conic-gradient(from 190deg at 50% 0%, transparent 0deg, rgba(99, 102, 241, 0.04) 14deg, transparent 28deg)",
          filter: "blur(55px)",
          animation: "beamSweep 16s ease-in-out infinite reverse",
        }} />
        {/* Central Ambient Radial Glow */}
        <div style={{
          position: "absolute", top: "25%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "800px", height: "500px",
          background: isDark
            ? "radial-gradient(circle, rgba(240, 61, 78, 0.06) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%)"
            : "radial-gradient(circle, rgba(240, 61, 78, 0.04) 0%, transparent 60%)",
          filter: "blur(60px)",
        }} />
      </div>

      <div className="flex-1 flex flex-col justify-between z-10 relative min-h-full h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 lg:px-12 w-full max-w-7xl mx-auto pt-24 sm:pt-28 pb-10">
          <section className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

              {/* Left Column: Brand Story & Conversion */}
              <motion.div
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left"
              >
                {/* Real-Time Live Campus Activity Stream */}
                <div className="mb-5">
                  <LiveActivityTicker />
                </div>

                {/* Primary Headline */}
                <motion.h1
                  initial={{ opacity: 0, filter: "blur(10px)", scale: 0.96 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                  className="leading-none select-none tracking-[0.04em] sm:tracking-[0.06em] text-4xl sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl font-bold mb-3 sm:mb-4 whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-b from-stone-900 via-stone-800 to-stone-600 dark:from-white dark:via-slate-100 dark:to-slate-400"
                  style={{
                    fontFamily: FC,
                    textShadow: isDark ? "0 0 60px rgba(255,255,255,0.15)" : "none",
                  }}
                >
                  SkylineOS
                </motion.h1>

                {/* Subtitle / Value Proposition */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.9 }}
                  className="max-w-xl"
                >
                  <p
                    className="text-base sm:text-lg md:text-xl font-medium leading-relaxed mb-2 text-stone-900 dark:text-slate-200"
                    style={{ fontFamily: FB }}
                  >
                    <Typewriter text="Run Your Whole Club From One Place" speed={22} />
                  </p>
                  <p
                    className="text-xs sm:text-sm text-stone-600 dark:text-slate-400 leading-relaxed"
                    style={{ fontFamily: FB }}
                  >
                    <Typewriter text="Retire the spreadsheet, the notebook and the WhatsApp chain. Memberships, event tickets, merch, announcements and the club budget in one unified platform." speed={22} delay={250} />
                  </p>
                </motion.div>

                {/* Dual Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3.5 w-full sm:w-auto"
                >
                  {/* Enter Dashboard */}
                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(66,133,244,0.45)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onEnter}
                    className="cursor-pointer group inline-flex items-center justify-center gap-2 px-7 sm:px-8 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#4285F4] to-[#1a73e8] dark:from-[#F03D4E] dark:to-[#e02d3e] hover:from-[#1a73e8] hover:to-[#174ea6] dark:hover:from-[#e02d3e] dark:hover:to-[#c82232] rounded-full transition-all duration-300 shadow-[0_0_24px_rgba(66,133,244,0.35)] dark:shadow-[0_0_24px_rgba(240,61,78,0.35)] active:scale-95"
                  >
                    <span>Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </motion.button>

                  {/* Register Club Button */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onRegister}
                    className="cursor-pointer group inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 text-sm font-medium rounded-full transition-all duration-300 bg-stone-900/5 hover:bg-stone-900/10 text-stone-900 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] dark:text-white active:scale-95 backdrop-blur-md border border-amber-900/10 dark:border-white/5"
                  >
                    <span>Register Club</span>
                  </motion.button>
                </motion.div>

                {/* Live Campus Telemetry Strip with Repeating Scroll Slide-in Animation */}
                <div className="mt-8 sm:mt-10 pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                  <motion.div
                    initial={{ opacity: 0, y: 35, scale: 0.93 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: false, amount: 0.15 }}
                    transition={{ duration: 0.65, delay: 0 * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -6, scale: 1.03, transition: { duration: 0.2 } }}
                    className="cursor-default p-3 rounded-2xl bg-[#FFFDF9]/95 dark:bg-white/[0.02] border border-amber-900/10 dark:border-white/5 backdrop-blur-sm shadow-[0_4px_20px_-4px_rgba(200,180,160,0.25)] dark:shadow-none"
                  >
                    <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-mono">
                      <InViewStatCounter target={stats.clubs > 0 ? stats.clubs : 9} suffix="+" />
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-stone-600 dark:text-slate-400 uppercase tracking-wider font-medium mt-0.5" style={{ fontFamily: FM }}>
                      Campus Clubs
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 35, scale: 0.93 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: false, amount: 0.15 }}
                    transition={{ duration: 0.65, delay: 1 * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -6, scale: 1.03, transition: { duration: 0.2 } }}
                    className="cursor-default p-3 rounded-2xl bg-[#FFFDF9]/95 dark:bg-white/[0.02] border border-amber-900/10 dark:border-white/5 backdrop-blur-sm shadow-[0_4px_20px_-4px_rgba(200,180,160,0.25)] dark:shadow-none"
                  >
                    <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-mono">
                      <InViewStatCounter target={stats.registrations > 0 ? stats.registrations : 21} suffix="+" />
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-stone-600 dark:text-slate-400 uppercase tracking-wider font-medium mt-0.5" style={{ fontFamily: FM }}>
                      Tickets Issued
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 35, scale: 0.93 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: false, amount: 0.15 }}
                    transition={{ duration: 0.65, delay: 2 * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -6, scale: 1.03, transition: { duration: 0.2 } }}
                    className="cursor-default p-3 rounded-2xl bg-[#FFFDF9]/95 dark:bg-white/[0.02] border border-amber-900/10 dark:border-white/5 backdrop-blur-sm shadow-[0_4px_20px_-4px_rgba(200,180,160,0.25)] dark:shadow-none"
                  >
                    <div className="text-xl sm:text-2xl font-bold text-[#1e8e3e] dark:text-emerald-400 font-mono">
                      <InViewStatCounter target={1} />
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-stone-600 dark:text-slate-400 uppercase tracking-wider font-medium mt-0.5" style={{ fontFamily: FM }}>
                      1 QR Pass for Everything
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 35, scale: 0.93 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: false, amount: 0.15 }}
                    transition={{ duration: 0.65, delay: 3 * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -6, scale: 1.03, transition: { duration: 0.2 } }}
                    className="cursor-default p-3 rounded-2xl bg-[#FFFDF9]/95 dark:bg-white/[0.02] border border-amber-900/10 dark:border-white/5 backdrop-blur-sm shadow-[0_4px_20px_-4px_rgba(200,180,160,0.25)] dark:shadow-none"
                  >
                    <div className="text-xl sm:text-2xl font-bold text-[#1a73e8] dark:text-cyan-400 font-mono">
                      <InViewStatCounter target={5} />
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-stone-600 dark:text-slate-400 uppercase tracking-wider font-medium mt-0.5" style={{ fontFamily: FM }}>
                      5 Tools Replaced
                    </div>
                  </motion.div>
                </div>

              </motion.div>

              {/* Right Column: Interactive 3D Holographic Ticket Pass */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 1.1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-5 flex justify-center items-center"
              >
                <InteractiveTicketPass />
              </motion.div>

            </div>
          </section>
        </div>

        {/* Core Capabilities Bento Grid */}
        <FeaturesSection />

        {/* Lifecycle Roadmap / Workflow */}
        <WorkflowSection />

        {/* Multi-Device Ecosystem Matrix */}
        <EcosystemSection />

        {/* Closing Call to Action Banner with Rich Entrance & Button Fade Animations */}
        <motion.section
          id="cta"
          initial={{ opacity: 0, y: 45, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.18 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -6, transition: { duration: 0.3 } }}
          className="w-full py-20 px-4 sm:px-8 max-w-5xl mx-auto text-center relative z-10"
        >
          <div className="rounded-3xl p-10 sm:p-14 bg-gradient-to-b from-[#4285F4]/12 via-[#FFFDF9]/90 to-[#FFFDF9] dark:from-[#F03D4E]/15 dark:via-black/50 dark:to-black/80 bg-[#FFFDF9] dark:bg-black backdrop-blur-2xl relative overflow-hidden shadow-[0_20px_50px_-15px_rgba(200,180,160,0.4)] dark:shadow-2xl border border-amber-900/10 dark:border-white/10 group">
            {/* Ambient Radial Pulse */}
            <motion.div
              animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-br from-[#4285F4]/15 dark:from-[#F03D4E]/20 via-transparent to-transparent pointer-events-none"
            />
            <div className="relative z-10 flex flex-col items-center">
              <motion.span
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-[11px] font-mono tracking-widest text-[#4285F4] dark:text-[#F03D4E] uppercase mb-3 inline-block"
                style={{ fontFamily: FM }}
              >
                RUN YOUR CLUB, NOT YOUR SPREADSHEETS
              </motion.span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-stone-900 dark:text-white mb-4 tracking-tight" style={{ fontFamily: FC }}>
                <Typewriter text="Ready to Run Your Club on Skyline?" speed={22} />
              </h2>
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-sm sm:text-base text-stone-600 dark:text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed"
                style={{ fontFamily: FB }}
              >
                Say goodbye to the spreadsheet, the notebook and the WhatsApp chain. Step into one platform that runs your whole club.
              </motion.p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <motion.button
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: false }}
                  transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ scale: 1.05, boxShadow: "0 0 35px rgba(66,133,244,0.6)" }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onEnter}
                  className="cursor-pointer px-8 py-3.5 rounded-full bg-[#4285F4] hover:bg-[#1a73e8] dark:bg-[#F03D4E] dark:hover:bg-[#d83544] text-white text-sm font-semibold tracking-wide transition-all shadow-lg shadow-blue-500/25 dark:shadow-red-500/30 active:scale-95 flex items-center gap-2"
                >
                  <span>Enter Command Center</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: false }}
                  transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onRegister}
                  className="cursor-pointer px-7 py-3.5 rounded-full border border-amber-900/15 dark:border-white/15 hover:border-amber-900/30 dark:hover:border-white/30 bg-stone-900/5 hover:bg-stone-900/10 dark:bg-white/5 dark:hover:bg-white/10 text-stone-800 dark:text-white text-sm font-medium transition-all backdrop-blur-md active:scale-95"
                >
                  <span>Register Authorized Club</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Minimal Footer */}
        <ShutterGlyphFooter
          brand="SKYLINE"
          wordmark="SKYLINE"
          company="SkylineOS · Universal Student Organization System"
          since={2026}
          shutterAt={2}
          background={isDark ? "#06070a" : "#f1f3f7"}
          ink={isDark ? "#ffffff" : "#0f172a"}
          signupLabel="Get early access to campus event drops & organizer updates"
          placeholder="Enter student or club email"
          socials={[
            { label: "GitHub", href: "https://github.com/abhishettyy/Skyline27" },
            { label: "Discord", href: "#" },
            { label: "LinkedIn", href: "#" },
          ]}
          legal={[
            { label: "Privacy Policy", href: "#" },
            { label: "Terms of Service", href: "#" },
            { label: "Contact Us", href: "#" },
          ]}
          onLinkClick={(label) => {
            const l = label.toLowerCase();
            if (l.includes("privac")) setActiveModal("privacy");
            else if (l.includes("term")) setActiveModal("terms");
            else if (l.includes("contact")) setActiveModal("contact");
          }}
          className={`w-full border-t ${isDark ? "border-white/5" : "border-slate-300/40"}`}
        />
      </div>

      <AnimatePresence>
        {activeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-2xl rounded-3xl p-8 max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl transition-colors"
              style={{
                background: isDark ? "#0a0a0a" : "#f0f2f6",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                color: isDark ? "#ffffff" : "#1e1b26"
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: FC, color: isDark ? "#ffffff" : "#1e1b26" }}>
                    {activeModal === 'privacy' && 'Dashboard Privacy Policy'}
                    {activeModal === 'terms' && 'Dashboard Terms of Service'}
                    {activeModal === 'contact' && 'Contact Us'}
                  </h3>
                  <p className="text-xs mt-1" style={{ fontFamily: FB, color: isDark ? "#999" : "#64748b" }}>
                    {activeModal === 'contact' ? 'Reach out to SkylineOS Support' : 'Last Updated: 10th October 2026'}
                  </p>
                </div>
                <button onClick={() => setActiveModal(null)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white" : "bg-black/5 hover:bg-black/10 text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <X size={16} />
                </button>
              </div>

              <div className={`flex-1 overflow-y-auto pr-2 space-y-6 text-sm leading-relaxed border-t border-b py-6 text-left ${isDark ? "text-[#ccc] border-white/5" : "text-slate-600 border-slate-200"
                }`} style={{ fontFamily: FB }}>
                {activeModal === 'privacy' && (
                  <>
                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Information We Collect From Clubs</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">We collect and store your Club Name, Email Address, UPI ID, UPI QR Code graphics, custom club logos, and event details (title, description, venue, price, capacity limits, banner graphics). New accounts are verified via single-use registration keys.</p>
                    </div>

                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Participant Information Available to Clubs</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">When users register for your events, we share their Name, USN/Roll Number, Email, Phone, Year, Semester, Branch, UPI Transaction ID (UTR), and payment proof screenshot URL with you to facilitate moderation.</p>
                    </div>

                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Handling Participant Information</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">Clubs must process participant data strictly to organize and conduct the event. You must not sell or share participant data with third parties, use it for unrelated spam/marketing, or store downloaded lists insecurely.</p>
                    </div>

                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Third-Party Services</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">We rely on secure authentication services, Supabase Storage (storing logos, posters, and user payment proof screenshots), and PostgreSQL databases to run the infrastructure.</p>
                    </div>
                  </>
                )}

                {activeModal === 'terms' && (
                  <>
                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">About the SkylineOS Club Dashboard</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">SkylineOS is an event management and ticketing platform for campus student clubs. Clubs use this dashboard to create events, manage registrations, verify payments, and scan attendee tickets.</p>
                    </div>

                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Club Responsibilities</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">You must only create authentic campus events. You are solely responsible for verifying UPI payments, managing ticket capacity, and ensuring timely refunds in case of event cancellations.</p>
                    </div>

                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Platform Role</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">SkylineOS provides the software platform. We are not an event organizer, payment processor, or ticket merchant. Payments occur directly via UPI between students and club accounts.</p>
                    </div>
                  </>
                )}

                {activeModal === 'contact' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1">General Support</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb]">For club setup assistance, bug reports, or feature requests:</p>
                      <a href="mailto:support@skyline.campus" className="text-xs text-[#F03D4E] hover:underline block mt-1">support@skyline.campus</a>
                    </div>

                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1">Club Onboarding & Secret Keys</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb]">Need a club registration key? Contact campus activities coordination:</p>
                      <a href="mailto:clubs@skyline.campus" className="text-xs text-[#F03D4E] hover:underline block mt-1">clubs@skyline.campus</a>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 text-xs text-slate-700 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-all font-semibold cursor-pointer border border-slate-300/80 dark:border-transparent" style={{ fontFamily: FB }}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
