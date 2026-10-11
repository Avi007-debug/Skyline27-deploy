import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GraduationCap, Mail, ShieldCheck, Store, X, ArrowRight } from "lucide-react";
import { fetchPublicStats } from "./api";
import { useTheme, ThemeToggle } from "../shared/theme";

const FC = "'Playfair Display', serif";
const F_LOGO = "'Cinzel', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

/** SkylineOS front door: production SaaS hero with direct student & club access, discreet admin console. */
export default function LandingPage({ onStudent, onClub, onAdmin, onBrowse }: { onStudent: () => void; onClub: () => void; onAdmin: () => void; onBrowse: () => void }) {
  const { theme, isDark } = useTheme();
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
    <div id="ls" className="h-[100dvh] min-h-[100dvh] w-full overflow-y-auto overflow-x-hidden flex flex-col relative bg-background touch-pan-y overscroll-none transition-colors duration-300">
      <div id="top-sentinel" className="absolute top-0 left-0 w-full h-10 pointer-events-none z-0" />

      {/* Modern Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-30 transition-all duration-500"
        style={{
          background: scrolled ? (isDark ? "rgba(5,5,5,0.92)" : "rgba(240,242,246,0.92)") : (isDark ? "rgba(5,5,5,0.2)" : "rgba(240,242,246,0.65)"),
          backdropFilter: scrolled ? "blur(20px)" : "blur(8px)",
          WebkitBackdropFilter: scrolled ? "blur(20px)" : "blur(8px)",
          borderBottom: scrolled ? (isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.08)") : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src="/logo.png" alt="SkylineOS Logo" className="h-8 sm:h-10 w-auto object-contain" />
            <span className="text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.3em] font-semibold whitespace-nowrap transition-colors" style={{ fontFamily: F_LOGO, color: isDark ? "#ffffff" : "#1e1b26" }}>SkylineOS</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button
              onClick={onClub}
              className="text-xs sm:text-sm px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-300 cursor-pointer font-medium hover:opacity-80"
              style={{
                color: isDark ? "rgba(255,255,255,0.75)" : "#475569",
                fontFamily: FB,
              }}
            >
              Club Portal
            </button>
            <button
              onClick={onBrowse}
              className="text-xs sm:text-sm px-4 sm:px-5 py-1.5 sm:py-2 rounded-full transition-all duration-400 cursor-pointer active:scale-95 font-medium"
              style={{
                border: isDark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.12)",
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)",
                color: isDark ? "rgba(255,255,255,0.9)" : "#1e1b26",
              }}
            >
              Browse events
            </button>
          </div>
        </div>
      </nav>

      {/* Ambient background light beam */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div style={{
          position: "absolute", top: "-10%", left: "50%",
          transform: "translateX(-50%)",
          width: "700px", height: "900px",
          background: isDark
            ? "conic-gradient(from 174deg at 50% 0%, transparent 0deg, rgba(255,255,255,0.035) 6deg, transparent 12deg)"
            : "conic-gradient(from 174deg at 50% 0%, transparent 0deg, rgba(222,63,15,0.04) 6deg, transparent 18deg)",
          filter: "blur(40px)",
          animation: "beamSweep 10s ease-in-out infinite",
        }} />
      </div>

      <div className="flex-1 flex flex-col justify-between z-10 relative min-h-full h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-8 lg:px-12 w-full max-w-7xl mx-auto pt-16 sm:pt-20 pb-4">
          <section className="flex-1 flex flex-col items-center justify-center text-center w-full">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center w-full my-auto"
            >
              <motion.h1
                initial={{ opacity: 0, filter: "blur(12px)", scale: 0.95 }}
                animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="leading-none select-none text-center w-full tracking-[0.03em] sm:tracking-[0.05em] md:tracking-[0.07em] lg:tracking-[0.08em] text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl 2xl:text-[6.5rem] font-semibold mb-2 sm:mb-4 whitespace-nowrap transition-colors"
                style={{
                  fontFamily: F_LOGO,
                  color: isDark ? "#ffffff" : "#1e1b26",
                  textShadow: isDark ? "0 0 80px rgba(255,255,255,0.12)" : "none",
                }}
              >
                SkylineOS
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="max-w-full sm:max-w-3xl mx-auto text-center px-4 mt-3 sm:mt-4 flex flex-col items-center gap-2 sm:gap-2.5"
              >
                <p
                  className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed transition-colors"
                  style={{ color: isDark ? "#d1d5db" : "#4b5563", fontFamily: FB }}
                >
                  The Complete Campus{" "}<span style={{ color: isDark ? "rgba(255,255,255,0.85)" : "#1e1b26" }}>Event Management Hub</span>
                </p>
              </motion.div>

              {/* Three Ellipse Buttons: Admin (Left) | Club (Center) | Student (Right) */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="mt-8 sm:mt-10 flex flex-col items-center gap-4 w-full"
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-lg">
                  {/* LEFT: ADMIN */}
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onAdmin}
                    className="w-full sm:w-auto flex-1 min-w-[130px] py-3.5 px-6 rounded-full text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer shadow-sm"
                    style={{
                      fontFamily: FB,
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
                      border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
                      color: isDark ? "#ffffff" : "#1e1b26",
                    }}
                  >
                    <ShieldCheck size={18} className="text-[#F03D4E]" />
                    <span>Admin</span>
                  </motion.button>

                  {/* CENTER: CLUB */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClub}
                    className="w-full sm:w-auto flex-1 min-w-[150px] py-3.5 px-7 rounded-full bg-[#F03D4E] hover:bg-[#d63545] text-white text-sm sm:text-base font-semibold flex items-center justify-center gap-2.5 shadow-lg shadow-[#F03D4E]/30 transition-all duration-300 cursor-pointer"
                    style={{ fontFamily: FB }}
                  >
                    <Store size={18} />
                    <span>Club</span>
                  </motion.button>

                  {/* RIGHT: STUDENT */}
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onStudent}
                    className="w-full sm:w-auto flex-1 min-w-[130px] py-3.5 px-6 rounded-full text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer shadow-sm"
                    style={{
                      fontFamily: FB,
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
                      border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
                      color: isDark ? "#ffffff" : "#1e1b26",
                    }}
                  >
                    <GraduationCap size={18} className="text-[#F03D4E]" />
                    <span>Student</span>
                  </motion.button>
                </div>

                {/* Sub-link: Browse without account */}
                <button
                  onClick={onBrowse}
                  className="cursor-pointer transition-colors hover:text-[#F03D4E] flex items-center gap-1.5 text-xs pt-1 font-medium"
                  style={{ color: isDark ? "#9ca3af" : "#64748b", fontFamily: FB }}
                >
                  <span>Browse events without account</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>

                {/* Live Stats Pill */}
                {(stats.totalEvents > 0 || stats.clubs > 0 || stats.liveEvents > 0) && (
                  <div
                    className="inline-flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs mt-3 px-4 py-2 rounded-full backdrop-blur-sm"
                    style={{
                      fontFamily: FM,
                      background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)",
                      border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)",
                      color: isDark ? "#9ca3af" : "#64748b",
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5 text-[#F03D4E] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F03D4E] animate-pulse" />
                      {stats.liveEvents || 8} Live Events
                    </span>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)" }}>|</span>
                    <span>{stats.clubs || 8}+ Clubs</span>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)" }}>|</span>
                    <span>{stats.totalStudents || 250}+ Students</span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </section>
        </div>

        {/* Footer */}
        <footer className={`w-full px-4 md:px-16 pb-4 sm:pb-6 pt-3 sm:pt-4 flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-4 border-t flex-shrink-0 transition-colors ${
          isDark ? "border-white/5" : "border-slate-300/60 bg-[#f0f2f6]"
        }`}>
          <div className="flex-1 flex justify-center md:justify-start">
            <span className="text-xs sm:text-sm tracking-[0.35em]" style={{ fontFamily: F_LOGO, color: isDark ? "rgba(255,255,255,0.4)" : "#64748b" }}>SkylineOS</span>
          </div>
          <p className="text-[10px] sm:text-xs text-center flex-shrink-0" style={{ color: isDark ? "#94a3b8" : "#64748b", fontFamily: FM }}>© 2026 SkylineOS. All rights reserved.</p>
          <div className="flex-1 flex justify-center md:justify-end items-center gap-5 text-[10px] sm:text-[11px]" style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
            <button onClick={onAdmin} className={`inline-flex items-center gap-1 transition-colors duration-300 hover:underline underline-offset-4 ${isDark ? "hover:text-white" : "hover:text-black"}`} style={{ fontFamily: FB }}>
              <ShieldCheck size={12} className="text-[#F03D4E]" /> Admin
            </button>
            <button onClick={() => setActiveModal('privacy')} className={`transition-colors duration-300 hover:underline underline-offset-4 ${isDark ? "hover:text-white" : "hover:text-black"}`} style={{ fontFamily: FB }}>Privacy</button>
            <button onClick={() => setActiveModal('terms')} className={`transition-colors duration-300 hover:underline underline-offset-4 ${isDark ? "hover:text-white" : "hover:text-black"}`} style={{ fontFamily: FB }}>Terms</button>
            <button onClick={() => setActiveModal('contact')} className={`transition-colors duration-300 hover:underline underline-offset-4 ${isDark ? "hover:text-white" : "hover:text-black"}`} style={{ fontFamily: FB }}>Contact Us</button>
          </div>
        </footer>
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isDark ? "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white" : "bg-black/5 hover:bg-black/10 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <X size={16} />
                </button>
              </div>

              <div className={`flex-1 overflow-y-auto pr-2 space-y-6 text-sm leading-relaxed border-t border-b py-6 text-left ${
                isDark ? "text-[#ccc] border-white/5" : "text-slate-600 border-slate-200"
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
                  </>
                )}

                {activeModal === 'terms' && (
                  <>
                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Platform Eligibility</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">Club access is restricted to verified campus organizations holding an authentic SkylineOS authorization key issued by institutional leadership.</p>
                    </div>

                    <div>
                      <h4 className="text-[#1e1b26] dark:text-white font-semibold text-sm mb-1.5">Direct Payments & Settlements</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">SkylineOS facilitates direct student-to-club peer payments via dynamic UPI QR generation. All ticketing funds settle directly to your designated club bank account without intermediary holding.</p>
                    </div>
                  </>
                )}

                {activeModal === 'contact' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">Need technical support, account key verification, or platform governance assistance? Reach out to our campus development team directly.</p>
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                      <Mail size={18} className="text-[#F03D4E]" />
                      <a href="mailto:abhishshetty05@gmail.com" className="text-xs font-semibold text-[#F03D4E] hover:underline">abhishshetty05@gmail.com</a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
