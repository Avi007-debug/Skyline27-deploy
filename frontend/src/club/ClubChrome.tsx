import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import type { ReactNode } from "react";
import { useTheme } from "../shared/theme";

const FB = "'Manrope', sans-serif";

/**
 * The club area's look: cursor flashlight, drifting background blobs and the
 * dashboard height rules. Used as a layout route for /for-clubs, /club/auth and /club.
 */
export default function ClubChrome({ children }: { children?: ReactNode }) {
  const { isDark } = useTheme();
  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 1024 || window.matchMedia("(hover: none)").matches) return;
    let ticking = false;
    const onMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setMousePos({ x: e.clientX, y: e.clientY });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="club-root min-h-screen bg-background text-foreground" style={{ fontFamily: FB }}>
      <div
        className="pointer-events-none fixed inset-0 z-50 hidden lg:block"
        style={{ background: `radial-gradient(720px circle at ${mousePos.x}px ${mousePos.y}px, ${isDark ? "rgba(255,255,255,0.038)" : "rgba(0,0,0,0.025)"}, transparent 50%)` }}
      />
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {children ?? <Outlet />}

      <style>{`
        .club-root ::-webkit-scrollbar { display: none; }
        .club-root * { scrollbar-width: none; }
        .dashboard-root { height: 100dvh; overflow: hidden; }
        @media (min-width: 768px) { .dashboard-root { height: auto; min-height: 100vh; overflow: visible; } }
        .club-root .blob {
          position: absolute; border-radius: 50%;
          filter: blur(100px); opacity: 0.08; will-change: transform;
          animation: morphBlob 22s ease-in-out infinite;
        }
        .club-root .blob-1 { width:750px; height:750px; background: radial-gradient(circle,rgba(240,61,78,.15),transparent 68%); top:-18%; left:-20%; animation-duration:20s; }
        .club-root .blob-2 { width:580px; height:580px; background: radial-gradient(circle,rgba(160,160,160,.25),transparent 68%); bottom:0; right:-14%; animation-duration:26s; animation-delay:-9s; }
        .club-root .blob-3 { width:440px; height:440px; background: radial-gradient(circle,rgba(240,61,78,.1),transparent 68%); top:42%; left:38%; animation-duration:32s; animation-delay:-16s; }
        html.light .club-root .blob { opacity: 0.12; }
        html.light .club-root .blob-1 { background: radial-gradient(circle,rgba(240,61,78,.12),transparent 68%); }
        html.light .club-root .blob-2 { background: radial-gradient(circle,rgba(200,205,215,.35),transparent 68%); }
        html.light .club-root .blob-3 { background: radial-gradient(circle,rgba(240,61,78,.08),transparent 68%); }
        @keyframes morphBlob {
          0%,100% { transform:translate(0,0) scale(1);          border-radius:60% 40% 70% 30%/50% 60% 40% 70%; }
          25%      { transform:translate(55px,-44px) scale(1.07); border-radius:40% 60% 30% 70%/60% 40% 70% 30%; }
          50%      { transform:translate(-32px,65px) scale(.93);  border-radius:70% 30% 50% 50%/30% 70% 50% 60%; }
          75%      { transform:translate(42px,28px) scale(1.04);  border-radius:50% 50% 60% 40%/70% 30% 60% 40%; }
        }
        @keyframes beamSweep {
          0%,100% { transform:translateX(-50%) rotate(-6deg); opacity:.55; }
          50%      { transform:translateX(-50%) rotate(6deg);  opacity:1;   }
        }
      `}</style>
    </div>
  );
}
