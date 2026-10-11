import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  ArrowRight, CalendarDays, GraduationCap, Mail, ShieldCheck,
  Store, X, Zap, Users, Shield, BarChart3, Sparkles,
} from "lucide-react";
import { fetchPublicStats } from "./api";
import { useTheme, ThemeToggle } from "../shared/theme";

// ── Stagger animation helpers ─────────────────────────────────────────────

const fadeUp = {
  initial:  { opacity: 0, y: 20 },
  animate:  { opacity: 1, y: 0 },
};

function StaggerChild({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function RevealOnScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Role cards data ───────────────────────────────────────────────────────

const ROLES = [
  {
    key: "student",
    title: "Student",
    body: "Find events, register in a tap, keep your tickets and merch orders in one place.",
    cta: "Continue as student",
    Icon: GraduationCap,
    accentLight: "#1a73e8",
    accentDark: "#4a8ff5",
    bgLight: "rgba(26,115,232,0.06)",
    bgDark: "rgba(74,143,245,0.08)",
  },
  {
    key: "club",
    title: "Club",
    body: "Publish events, verify payments, check people in at the door and manage members.",
    cta: "Open club dashboard",
    Icon: Store,
    accentLight: "#188038",
    accentDark: "#4ade80",
    bgLight: "rgba(24,128,56,0.06)",
    bgDark: "rgba(74,222,128,0.08)",
  },
  {
    key: "admin",
    title: "Admin",
    body: "Issue club registration keys and oversee every club, event and account.",
    cta: "Admin sign in",
    Icon: ShieldCheck,
    accentLight: "#b45309",
    accentDark: "#fbbf24",
    bgLight: "rgba(180,83,9,0.06)",
    bgDark: "rgba(251,191,36,0.08)",
  },
] as const;

// ── Feature pills ─────────────────────────────────────────────────────────

const FEATURES = [
  { Icon: Zap,      label: "Instant event publishing" },
  { Icon: Shield,   label: "Cryptographic ledger" },
  { Icon: Users,    label: "Member pricing & dues" },
  { Icon: BarChart3, label: "Semester P&L reports" },
  { Icon: Sparkles, label: "QR ticket verification" },
] as const;

// ── Dark mode aurora decoration ────────────────────────────────────────────

function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Blue orb */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(74,143,245,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      {/* Purple orb */}
      <motion.div
        animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/3 -right-32 w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />
      {/* Teal orb */}
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, 20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 6 }}
        className="absolute bottom-0 left-1/3 w-[350px] h-[350px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}

// ── Light mode GDG dot grid pattern ───────────────────────────────────────

function GridPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        opacity: 0.45,
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** SkylineOS front door: what the product is, and one clear way in for each role. */
export default function LandingPage({
  onStudent, onClub, onAdmin, onBrowse,
}: {
  onStudent: () => void;
  onClub: () => void;
  onAdmin: () => void;
  onBrowse: () => void;
}) {
  const { isDark } = useTheme();
  const [stats, setStats] = useState({ liveEvents: 0, clubs: 0, totalEvents: 0, totalStudents: 0 });
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'contact' | null>(null);

  useEffect(() => {
    fetchPublicStats()
      .then(data => setStats({
        liveEvents: data.liveEvents || 0,
        clubs: data.clubs || 0,
        totalEvents: data.totalEvents || 0,
        totalStudents: data.totalStudents || 0,
      }))
      .catch(() => {});
  }, []);

  const go = { student: onStudent, club: onClub, admin: onAdmin };

  const figures = [
    stats.totalEvents    > 0 && { value: stats.totalEvents,    label: "events"   },
    stats.clubs          > 0 && { value: stats.clubs,          label: "clubs"     },
    stats.totalStudents  > 0 && { value: stats.totalStudents,  label: "students"  },
  ].filter(Boolean) as Array<{ value: number; label: string }>;

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col relative"
      style={{
        background: isDark ? "var(--sk-canvas)" : "#ffffff",
        fontFamily: "var(--sk-font)",
        color: "var(--sk-fg)",
      }}
    >
      {/* Background decorations */}
      {isDark ? <AuroraBackground /> : <GridPattern />}

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--sk-line)",
          background: isDark ? "rgba(11,11,13,0.80)" : "rgba(255,255,255,0.90)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2.5"
          >
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain rounded-lg" />
            <span
              className="text-[15px] font-semibold tracking-tight"
              style={{ color: "var(--sk-fg)", fontFamily: "var(--sk-font)" }}
            >
              SkylineOS
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2"
          >
            <button
              onClick={onBrowse}
              className="hidden sm:inline-flex h-9 items-center px-3.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: "var(--sk-muted)",
                background: "transparent",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--sk-raised)";
                (e.currentTarget as HTMLElement).style.color = "var(--sk-fg)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--sk-muted)";
              }}
            >
              Browse events
            </button>
            <ThemeToggle />
          </motion.div>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 relative z-10">
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-20 sm:pt-28 pb-16">

          {/* Live event badge */}
          <StaggerChild delay={0}>
            {stats.liveEvents > 0 && (
              <button
                onClick={onBrowse}
                className="inline-flex items-center gap-2 mb-8 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all"
                style={{
                  background: isDark ? "var(--sk-brand-xsoft)" : "var(--sk-brand-xsoft)",
                  borderColor: isDark ? "var(--sk-brand-soft)" : "rgba(26,115,232,0.20)",
                  color: isDark ? "var(--sk-brand)" : "#1a73e8",
                }}
              >
                <span
                  className="relative flex h-2 w-2"
                >
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: isDark ? "var(--sk-brand)" : "#1a73e8" }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ background: isDark ? "var(--sk-brand)" : "#1a73e8" }}
                  />
                </span>
                {stats.liveEvents} {stats.liveEvents === 1 ? "event" : "events"} open for registration
                <ArrowRight size={13} />
              </button>
            )}
          </StaggerChild>

          <StaggerChild delay={0.05}>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] max-w-3xl"
              style={{
                fontFamily: "var(--sk-font)",
                color: "var(--sk-fg)",
              }}
            >
              Campus events,{" "}
              <span
                className="relative"
                style={{ color: isDark ? "var(--sk-brand)" : "#1a73e8" }}
              >
                without the
                {/* Underline decoration in light mode */}
                {!isDark && (
                  <svg
                    aria-hidden
                    viewBox="0 0 220 8"
                    fill="none"
                    className="absolute left-0 -bottom-1.5 w-full"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 6 C40 2 80 2 110 4 C140 6 180 6 218 3"
                      stroke="#1a73e8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                  </svg>
                )}
              </span>
              {" "}spreadsheets.
            </h1>
          </StaggerChild>

          <StaggerChild delay={0.10}>
            <p
              className="mt-6 text-base sm:text-lg leading-relaxed max-w-xl"
              style={{ color: "var(--sk-muted)" }}
            >
              SkylineOS is where your college's clubs publish events and sell merch,
              and where students register, pay and get their tickets — all in one place.
            </p>
          </StaggerChild>

          <StaggerChild delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onBrowse}
                className="inline-flex h-11 items-center gap-2 px-5 rounded-xl text-sm font-semibold transition-all shadow-md"
                style={{
                  background: isDark ? "var(--sk-brand)" : "#1a73e8",
                  color: "#ffffff",
                  boxShadow: isDark ? "var(--sk-shadow-brand)" : "0 4px 16px rgba(26,115,232,0.30)",
                }}
              >
                <CalendarDays size={16} /> See what's on
              </motion.button>
              <span className="text-sm" style={{ color: "var(--sk-faint)" }}>
                No account needed to browse.
              </span>
            </div>
          </StaggerChild>

          {/* Feature pills */}
          <StaggerChild delay={0.20}>
            <div className="mt-10 flex flex-wrap gap-2">
              {FEATURES.map(({ Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                  style={{
                    borderColor: "var(--sk-line)",
                    background: "var(--sk-raised)",
                    color: "var(--sk-muted)",
                  }}
                >
                  <Icon size={12} style={{ color: isDark ? "var(--sk-brand)" : "#1a73e8" }} />
                  {label}
                </span>
              ))}
            </div>
          </StaggerChild>
        </section>

        {/* ── Role cards ── */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-20" aria-labelledby="choose-role">
          <RevealOnScroll>
            <p
              className="text-xs font-semibold uppercase tracking-[0.12em] mb-5"
              style={{ color: "var(--sk-faint)" }}
              id="choose-role"
            >
              Sign in as
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {ROLES.map(({ key, title, body, cta, Icon, accentLight, accentDark, bgLight, bgDark }, i) => {
                const accent = isDark ? accentDark : accentLight;
                const bg = isDark ? bgDark : bgLight;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    aria-label={`${title}: ${cta}`}
                    onClick={go[key]}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -3, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="group text-left rounded-2xl border p-6 transition-all"
                    style={{
                      borderColor: "var(--sk-line)",
                      background: isDark ? "var(--sk-surface)" : "#ffffff",
                      boxShadow: isDark ? "none" : "var(--sk-shadow)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = accent;
                      (e.currentTarget as HTMLElement).style.boxShadow = isDark
                        ? `0 0 0 1px ${accent}30, 0 8px 32px rgba(0,0,0,0.4)`
                        : `0 0 0 1px ${accent}20, var(--sk-shadow-md)`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--sk-line)";
                      (e.currentTarget as HTMLElement).style.boxShadow = isDark ? "none" : "var(--sk-shadow)";
                    }}
                  >
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4"
                      style={{ background: bg, color: accent }}
                    >
                      <Icon size={20} />
                    </span>
                    <span
                      className="block text-base font-semibold mb-1.5"
                      style={{ color: "var(--sk-fg)", fontFamily: "var(--sk-font)" }}
                    >
                      {title}
                    </span>
                    <span
                      className="block text-sm leading-relaxed mb-5"
                      style={{ color: "var(--sk-muted)" }}
                    >
                      {body}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all"
                      style={{ color: accent }}
                    >
                      {cta}
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </RevealOnScroll>

          {/* Stats */}
          {figures.length > 0 && (
            <RevealOnScroll>
              <dl
                className="mt-12 flex flex-wrap gap-x-10 gap-y-5 pt-8 border-t"
                style={{ borderColor: "var(--sk-line)" }}
              >
                {figures.map(f => (
                  <div key={f.label}>
                    <dt className="sr-only">{f.label}</dt>
                    <dd className="text-sm" style={{ color: "var(--sk-muted)" }}>
                      <span
                        className="text-2xl font-bold tabular-nums mr-1.5"
                        style={{ color: "var(--sk-fg)", fontFamily: "var(--sk-font)" }}
                      >
                        {f.value.toLocaleString('en-IN')}
                      </span>
                      {f.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </RevealOnScroll>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 border-t"
        style={{ borderColor: "var(--sk-line)" }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--sk-faint)" }}>
          <p>© 2026 SkylineOS</p>
          <nav className="flex items-center gap-5" aria-label="Legal">
            {(['privacy', 'terms', 'contact'] as const).map(m => (
              <button
                key={m}
                onClick={() => setActiveModal(m)}
                className="capitalize transition-colors hover:text-[color:var(--sk-fg)]"
              >
                {m}
              </button>
            ))}
          </nav>
        </div>
      </footer>

      {/* ── Modals ── */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
            onClick={e => { if (e.target === e.currentTarget) setActiveModal(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="w-full max-w-lg rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto flex flex-col"
              style={{
                background: "var(--sk-surface)",
                border: "1px solid var(--sk-line)",
                boxShadow: "var(--sk-shadow-lg)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--sk-fg)", fontFamily: "var(--sk-font)" }}>
                    {activeModal === 'privacy' && 'Privacy Policy'}
                    {activeModal === 'terms'   && 'Terms of Service'}
                    {activeModal === 'contact' && 'Contact Us'}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--sk-faint)" }}>
                    {activeModal === 'contact' ? 'Reach out to SkylineOS Support' : 'Last updated: 10 October 2026'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="flex-shrink-0 ml-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: "var(--sk-raised)", color: "var(--sk-muted)" }}
                >
                  <X size={15} />
                </button>
              </div>

              <div
                className="flex-1 overflow-y-auto pr-1 space-y-5 text-sm leading-relaxed border-t border-b py-6"
                style={{ borderColor: "var(--sk-line)", color: "var(--sk-muted)" }}
              >
                {activeModal === 'privacy' && (
                  <>
                    <div>
                      <h4 className="font-semibold mb-1.5 text-sm" style={{ color: "var(--sk-fg)" }}>Information We Collect From Clubs</h4>
                      <p className="text-xs leading-relaxed">We collect and store your Club Name, Email Address, UPI ID, UPI QR Code graphics, custom club logos, and event details (title, description, venue, price, capacity limits, banner graphics). New accounts are verified via single-use registration keys.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1.5 text-sm" style={{ color: "var(--sk-fg)" }}>Participant Information Available to Clubs</h4>
                      <p className="text-xs leading-relaxed">When users register for your events, we share their Name, USN/Roll Number, Email, Phone, Year, Semester, Branch, UPI Transaction ID (UTR), and payment proof screenshot URL with you to facilitate moderation.</p>
                    </div>
                  </>
                )}
                {activeModal === 'terms' && (
                  <>
                    <div>
                      <h4 className="font-semibold mb-1.5 text-sm" style={{ color: "var(--sk-fg)" }}>Platform Eligibility</h4>
                      <p className="text-xs leading-relaxed">Club access is restricted to verified campus organizations holding an authentic SkylineOS authorization key issued by institutional leadership.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1.5 text-sm" style={{ color: "var(--sk-fg)" }}>Direct Payments & Settlements</h4>
                      <p className="text-xs leading-relaxed">SkylineOS facilitates direct student-to-club peer payments via dynamic UPI QR generation. All ticketing funds settle directly to your designated club bank account without intermediary holding.</p>
                    </div>
                  </>
                )}
                {activeModal === 'contact' && (
                  <div className="space-y-4">
                    <p className="text-xs leading-relaxed">Need technical support, account key verification, or platform governance assistance? Reach out to our campus development team directly.</p>
                    <div
                      className="flex items-center gap-3 p-4 rounded-xl border"
                      style={{ background: "var(--sk-raised)", borderColor: "var(--sk-line)" }}
                    >
                      <Mail size={18} style={{ color: "var(--sk-brand)", flexShrink: 0 }} />
                      <a
                        href="mailto:abhishshetty05@gmail.com"
                        className="text-xs font-semibold hover:underline underline-offset-2"
                        style={{ color: "var(--sk-brand)" }}
                      >
                        abhishshetty05@gmail.com
                      </a>
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
