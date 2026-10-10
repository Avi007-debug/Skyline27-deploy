import { motion } from "motion/react";
import { Smartphone, LayoutDashboard, Globe, ShieldCheck } from "lucide-react";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

const CLIENTS = [
  {
    icon: Smartphone,
    title: "Skyline Mobile",
    tech: "Flutter 3.x · Material 3",
    desc: "Native student companion for event browsing, passkey squads, UPI proof uploading, and offline ticket QR wallet.",
    color: "from-blue-500/10 to-transparent",
    tag: "iOS & Android",
  },
  {
    icon: LayoutDashboard,
    title: "Skyline Dashboard",
    tech: "React 18 · Vite · Tailwind",
    desc: "Club command center to create events, manage rosters, verify payments, and scan attendee QR codes at venue doors.",
    color: "from-red-500/10 to-transparent",
    tag: "Organizer Web",
  },
  {
    icon: Globe,
    title: "Student WebApp",
    tech: "React 19 · Zustand · PWA",
    desc: "Instant web access for students on laptops to register, view passes, and join squads without app store installation.",
    color: "from-cyan-500/10 to-transparent",
    tag: "Universal PWA",
  },
  {
    icon: ShieldCheck,
    title: "Skyline Admin",
    tech: "React 19 · Tailwind v4",
    desc: "Centralized governance console for platform owners to generate single-use club keys and audit registered clubs.",
    color: "from-purple-500/10 to-transparent",
    tag: "Superadmin Portal",
  },
];

export default function EcosystemSection() {
  return (
    <section id="ecosystem" className="w-full py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto relative z-10">
      {/* Header with Repeating Scroll Animation */}
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4" style={{ fontFamily: FC }}>
          The SkylineOS Ecosystem
        </h2>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
          A coordinated matrix of native mobile apps, web command consoles, and central REST APIs operating in perfect sync.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CLIENTS.map((client, idx) => {
          const Icon = client.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 35, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.15 }}
              transition={{ duration: 0.6, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className={`rounded-3xl p-6 bg-gradient-to-b ${client.color} bg-[#0c0d15]/90 backdrop-blur-2xl flex flex-col justify-between transition-all shadow-2xl shadow-black/40 cursor-default`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white">
                    <Icon className="w-5 h-5 text-slate-300" />
                  </div>
                  <span className="text-[9px] font-mono tracking-wider text-slate-400 uppercase px-2 py-0.5 rounded-full bg-white/5">
                    {client.tag}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: FB }}>
                  {client.title}
                </h3>
                <div className="text-[10px] font-mono text-[#F03D4E] mb-3">
                  {client.tech}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed" style={{ fontFamily: FB }}>
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
