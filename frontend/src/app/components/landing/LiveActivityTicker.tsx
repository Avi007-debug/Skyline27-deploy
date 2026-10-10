import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Ticket, CreditCard, Key, ShieldCheck } from "lucide-react";

const FM = "'JetBrains Mono', monospace";

const ACTIVITIES = [
  {
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    text: "Team CyberKnights checked in at Main Auditorium",
    time: "2s ago",
  },
  {
    icon: Ticket,
    color: "text-red-400",
    bg: "bg-red-400/10",
    text: "14 passes claimed for Skyline CyberHack '26",
    time: "48s ago",
  },
  {
    icon: CreditCard,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    text: "UPI payment verified by Robotics Club",
    time: "2m ago",
  },
  {
    icon: Key,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    text: "New Club Key redeemed: SKYLINE-A89F-Q",
    time: "4m ago",
  },
  {
    icon: ShieldCheck,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    text: "Squad auto-enrolled with passkey #K9X2B",
    time: "6m ago",
  },
];

export default function LiveActivityTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const current = ACTIVITIES[index];
  const IconComponent = current.icon;

  return (
    <div className="inline-flex items-center">
      <div className="relative flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-2xl shadow-lg shadow-black/20 overflow-hidden">
        {/* Dynamic Activity Content with Slide Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-300"
            style={{ fontFamily: FM }}
          >
            <span className={`p-1 rounded-md ${current.bg} ${current.color} flex items-center justify-center`}>
              <IconComponent className="w-3 h-3" />
            </span>
            <span className="font-medium text-white/90 truncate max-w-[220px] sm:max-w-[340px]">
              {current.text}
            </span>
            <span className="text-[10px] text-slate-400 font-normal flex-shrink-0">
              • {current.time}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
