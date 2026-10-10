import { motion } from "motion/react";
import { Smartphone, LayoutDashboard, Globe, ShieldCheck } from "lucide-react";
import Typewriter from "./Typewriter";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

const CLIENTS = [
  {
    icon: Smartphone,
    title: "Skyline Mobile",
    tech: "Flutter 3.x · Material 3",
    desc: "Student companion to browse events, buy tickets and merch, show the Club Pass and track dues.",
    color: "from-[#4285F4]/12 dark:from-blue-500/10 to-transparent",
    techColor: "text-[#1a73e8] dark:text-blue-400",
    tag: "iOS & Android",
  },
  {
    icon: LayoutDashboard,
    title: "Skyline Dashboard",
    tech: "React 18 · Vite · Tailwind",
    desc: "Officer console to manage members, create events, post announcements, run the merch store and scan tickets at the door.",
    color: "from-[#EA4335]/12 dark:from-red-500/10 to-transparent",
    techColor: "text-[#d93025] dark:text-red-400",
    tag: "Organizer Web",
  },
  {
    icon: Globe,
    title: "Student WebApp",
    tech: "React 19 · Zustand · PWA",
    desc: "Instant web access for students on laptops to join, buy and view passes without an app store install.",
    color: "from-[#FBBC04]/14 dark:from-amber-500/10 to-transparent",
    techColor: "text-[#d97706] dark:text-amber-400",
    tag: "Universal PWA",
  },
  {
    icon: ShieldCheck,
    title: "Skyline Admin",
    tech: "React 19 · Tailwind v4",
    desc: "Platform admin console to issue single-use club keys and view registered clubs.",
    color: "from-[#34A853]/12 dark:from-emerald-500/10 to-transparent",
    techColor: "text-[#1e8e3e] dark:text-emerald-400",
    tag: "Superadmin Portal",
  },
];

export default function EcosystemSection() {
  return (
    <section id="ecosystem" className="w-full py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto relative z-10">
      {/* Header with Typewriter Animation */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.25 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-4" style={{ fontFamily: FC }}>
          <Typewriter text="The SkylineOS Ecosystem" speed={22} />
        </h2>
        <p className="text-sm sm:text-base text-stone-600 dark:text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
          <Typewriter text="Student apps, an officer console and one shared backend, kept in sync." speed={22} delay={250} />
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CLIENTS.map((client, idx) => {
          const Icon = client.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 45, scale: 0.93 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.15 }}
              transition={{ duration: 0.7, delay: idx * 0.09, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, scale: 1.02, boxShadow: "0 25px 60px -15px rgba(0,0,0,0.25)", transition: { duration: 0.25 } }}
              className={`group rounded-3xl p-6 bg-gradient-to-b ${client.color} bg-[#FFFDF9]/95 dark:bg-[#0c0d15]/90 backdrop-blur-2xl flex flex-col justify-between transition-all shadow-[0_15px_35px_-10px_rgba(200,180,160,0.35)] dark:shadow-2xl dark:shadow-black/40 cursor-default border border-amber-900/10 dark:border-white/5 hover:border-amber-900/25 dark:hover:border-white/15`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-stone-700 dark:text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                    <Icon className="w-5 h-5 text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-[9px] font-mono tracking-wider text-stone-600 dark:text-slate-400 uppercase px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-stone-200/60 dark:border-transparent">
                    {client.tag}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-1" style={{ fontFamily: FB }}>
                  {client.title}
                </h3>
                <div className={`text-[10px] font-mono mb-3 ${client.techColor}`}>
                  {client.tech}
                </div>

                <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
                  {client.desc}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
