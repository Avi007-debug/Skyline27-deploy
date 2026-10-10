import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Ticket, CreditCard, Key, ShieldCheck } from "lucide-react";

const FM = "'JetBrains Mono', monospace";

const ACTIVITIES = [
  {
    icon: ShieldCheck,
    color: "text-[#1a73e8] dark:text-blue-400",
    bg: "bg-[#4285F4]/15",
    text: "Priya renewed her membership",
    time: "6m ago",
  },
  {
    icon: Ticket,
    color: "text-[#d93025] dark:text-red-400",
    bg: "bg-[#EA4335]/15",
    text: "2 hoodies sold: M × 2",
    time: "4m ago",
  },
  {
    icon: Zap,
    color: "text-[#1e8e3e] dark:text-emerald-400",
    bg: "bg-[#34A853]/15",
    text: "Gala ticket checked in at the door",
    time: "1m ago",
  },
];

export default function LiveActivityTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const current = ACTIVITIES[index];
  const IconComponent = current.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center"
    >
      <div className="relative flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#FFFDF9]/95 dark:bg-white/[0.04] border border-amber-900/10 dark:border-white/5 backdrop-blur-2xl shadow-[0_4px_15px_-4px_rgba(200,180,160,0.3)] dark:shadow-lg dark:shadow-black/20 overflow-hidden">
        {/* Dynamic Activity Content with Slide Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 text-[11px] sm:text-xs text-stone-700 dark:text-slate-300"
            style={{ fontFamily: FM }}
          >
            <span className={`p-1 rounded-md ${current.bg} ${current.color} flex items-center justify-center`}>
              <IconComponent className="w-3 h-3" />
            </span>
            <span className="font-medium text-stone-900 dark:text-white/90 truncate max-w-[220px] sm:max-w-[340px]">
              {current.text}
            </span>
            <span className="text-[10px] text-stone-500 dark:text-slate-400 font-normal flex-shrink-0">
              • {current.time}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
