import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, CalendarDays, GraduationCap, Mail, ShieldCheck, Store, X } from "lucide-react";
import { fetchPublicStats } from "./api";
import { useTheme, ThemeToggle } from "../shared/theme";

const FC = "var(--sk-font)";
const FB = "var(--sk-font)";

const ROLES = [
  {
    key: "student",
    title: "Student",
    body: "Find events, register in a tap, keep your tickets and merch orders in one place.",
    cta: "Continue as student",
    Icon: GraduationCap,
  },
  {
    key: "club",
    title: "Club",
    body: "Publish events, verify payments, check people in at the door and manage members.",
    cta: "Open club dashboard",
    Icon: Store,
  },
  {
    key: "admin",
    title: "Admin",
    body: "Issue club registration keys and oversee every club, event and account.",
    cta: "Admin sign in",
    Icon: ShieldCheck,
  },
] as const;

/** SkylineOS front door: what the product is, and one clear way in for each role. */
export default function LandingPage({ onStudent, onClub, onAdmin, onBrowse }: { onStudent: () => void; onClub: () => void; onAdmin: () => void; onBrowse: () => void }) {
  const { isDark } = useTheme();
  const [stats, setStats] = useState({ liveEvents: 0, clubs: 0, totalEvents: 0, totalStudents: 0 });
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'contact' | null>(null);

  useEffect(() => {
    fetchPublicStats()
      .then(data => setStats({ liveEvents: data.liveEvents || 0, clubs: data.clubs || 0, totalEvents: data.totalEvents || 0, totalStudents: data.totalStudents || 0 }))
      .catch(() => {});
  }, []);

  const go = { student: onStudent, club: onClub, admin: onAdmin };
  const figures = [
    stats.totalEvents > 0 && { value: stats.totalEvents, label: stats.totalEvents === 1 ? "event" : "events" },
    stats.clubs > 0 && { value: stats.clubs, label: stats.clubs === 1 ? "club" : "clubs" },
    stats.totalStudents > 0 && { value: stats.totalStudents, label: stats.totalStudents === 1 ? "student" : "students" },
  ].filter(Boolean) as Array<{ value: number; label: string }>;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background" style={{ fontFamily: FB }}>
      <header className="sticky top-0 z-30 border-b border-[color:var(--sk-line)] bg-[color:var(--sk-canvas)]/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-[color:var(--sk-fg)]">SkylineOS</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onBrowse} className="hidden sm:inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium text-[color:var(--sk-muted)] hover:text-[color:var(--sk-fg)] hover:bg-[color:var(--sk-raised)] transition-colors">
              Browse events
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-14">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="max-w-2xl">
            {stats.liveEvents > 0 && (
              <button onClick={onBrowse} className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium text-[color:var(--sk-muted)] hover:text-[color:var(--sk-fg)] transition-colors">
                {stats.liveEvents} {stats.liveEvents === 1 ? "event is" : "events are"} open for registration
                <ArrowRight size={12} />
              </button>
            )}
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] text-[color:var(--sk-fg)]" style={{ fontFamily: FC }}>
              Campus events,<br className="hidden sm:block" /> without the spreadsheets.
            </h1>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-[color:var(--sk-muted)] max-w-xl">
              SkylineOS is where your college's clubs publish events and sell merch, and where students register, pay and get their tickets.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={onBrowse} className="inline-flex h-10 items-center gap-2 px-4 rounded-lg bg-[color:var(--sk-fg)] text-[color:var(--sk-canvas)] text-sm font-medium hover:opacity-90 transition-opacity">
                <CalendarDays size={16} /> See what's on
              </button>
              <span className="text-sm text-[color:var(--sk-faint)]">No account needed to browse.</span>
            </div>
          </motion.div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-16" aria-labelledby="choose-role">
          <h2 id="choose-role" className="text-sm font-medium text-[color:var(--sk-muted)] mb-4">Sign in as</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {ROLES.map(({ key, title, body, cta, Icon }, i) => (
              <motion.button
                key={key}
                type="button"
                aria-label={`${title}: ${cta}`}
                onClick={go[key]}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i, ease: "easeOut" }}
                className="group text-left rounded-xl border border-[color:var(--sk-line)] bg-[color:var(--sk-surface)] p-5 sm:p-6 hover:border-[color:var(--sk-line-strong)] focus-visible:outline-2 focus-visible:outline-[color:var(--sk-brand)] transition-colors"
                style={{ boxShadow: "var(--sk-shadow)" }}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--sk-raised)] text-[color:var(--sk-fg)]">
                  <Icon size={18} />
                </span>
                <span className="mt-4 block text-base font-semibold text-[color:var(--sk-fg)]">{title}</span>
                <span className="mt-1.5 block text-sm leading-relaxed text-[color:var(--sk-muted)]">{body}</span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--sk-fg)]">
                  {cta}
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </motion.button>
            ))}
          </div>

          {figures.length > 0 && (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {figures.map(f => (
                <div key={f.label}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="text-sm text-[color:var(--sk-muted)]">
                    <span className="text-xl font-semibold text-[color:var(--sk-fg)] tabular-nums mr-1.5">{f.value}</span>{f.label}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </main>

      <footer className="border-t border-[color:var(--sk-line)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[color:var(--sk-faint)]">
          <p>© 2026 SkylineOS</p>
          <nav className="flex items-center gap-5" aria-label="Legal">
            <button onClick={() => setActiveModal('privacy')} className="hover:text-[color:var(--sk-fg)] transition-colors">Privacy</button>
            <button onClick={() => setActiveModal('terms')} className="hover:text-[color:var(--sk-fg)] transition-colors">Terms</button>
            <button onClick={() => setActiveModal('contact')} className="hover:text-[color:var(--sk-fg)] transition-colors">Contact</button>
          </nav>
        </div>
      </footer>

      <AnimatePresence>
        {activeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
              className="w-full max-w-xl rounded-xl p-6 sm:p-7 max-h-[85vh] overflow-y-auto flex flex-col"
              style={{
                background: "var(--sk-surface)",
                border: "1px solid var(--sk-line)",
                color: "var(--sk-fg)"
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: FC, color: "var(--sk-fg)" }}>
                    {activeModal === 'privacy' && 'Dashboard Privacy Policy'}
                    {activeModal === 'terms' && 'Dashboard Terms of Service'}
                    {activeModal === 'contact' && 'Contact Us'}
                  </h3>
                  <p className="text-xs mt-1" style={{ fontFamily: FB, color: "var(--sk-muted)" }}>
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
                      <h4 className="text-[color:var(--sk-fg)] dark:text-white font-semibold text-sm mb-1.5">Information We Collect From Clubs</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">We collect and store your Club Name, Email Address, UPI ID, UPI QR Code graphics, custom club logos, and event details (title, description, venue, price, capacity limits, banner graphics). New accounts are verified via single-use registration keys.</p>
                    </div>

                    <div>
                      <h4 className="text-[color:var(--sk-fg)] dark:text-white font-semibold text-sm mb-1.5">Participant Information Available to Clubs</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">When users register for your events, we share their Name, USN/Roll Number, Email, Phone, Year, Semester, Branch, UPI Transaction ID (UTR), and payment proof screenshot URL with you to facilitate moderation.</p>
                    </div>
                  </>
                )}

                {activeModal === 'terms' && (
                  <>
                    <div>
                      <h4 className="text-[color:var(--sk-fg)] dark:text-white font-semibold text-sm mb-1.5">Platform Eligibility</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">Club access is restricted to verified campus organizations holding an authentic SkylineOS authorization key issued by institutional leadership.</p>
                    </div>

                    <div>
                      <h4 className="text-[color:var(--sk-fg)] dark:text-white font-semibold text-sm mb-1.5">Direct Payments & Settlements</h4>
                      <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">SkylineOS facilitates direct student-to-club peer payments via dynamic UPI QR generation. All ticketing funds settle directly to your designated club bank account without intermediary holding.</p>
                    </div>
                  </>
                )}

                {activeModal === 'contact' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600 dark:text-[#bbbbbb] leading-relaxed">Need technical support, account key verification, or platform governance assistance? Reach out to our campus development team directly.</p>
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                      <Mail size={18} className="text-[color:var(--sk-brand)]" />
                      <a href="mailto:abhishshetty05@gmail.com" className="text-xs font-semibold text-[color:var(--sk-brand)] hover:underline">abhishshetty05@gmail.com</a>
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
