import { Outlet } from "react-router";
import type { ReactNode } from "react";

/**
 * Layout for the club area (/club/auth, /club) and the landing page: a plain canvas and the
 * dashboard height rules. Colours come from styles/tokens.css, so both themes follow the system.
 */
export default function ClubChrome({ children }: { children?: ReactNode }) {
  return (
    <div className="club-root min-h-screen bg-background text-foreground" style={{ fontFamily: "var(--sk-font)" }}>
      {children ?? <Outlet />}

      <style>{`
        .club-root { scrollbar-width: thin; scrollbar-color: var(--sk-line-strong) transparent; }
        .club-nav-item {
          position: relative; display: flex; align-items: center; gap: 10px; width: 100%; height: 34px; padding: 0 10px;
          border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--sk-muted) !important; text-align: left;
          transition: background .12s, color .12s;
        }
        .club-nav-item:hover { background: var(--sk-raised); color: var(--sk-fg) !important; }
        .club-nav-item[aria-current="page"] { background: var(--sk-raised); color: var(--sk-fg) !important; font-weight: 600; }
        .club-nav-item[aria-current="page"]::before {
          content: ""; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--sk-brand);
        }
        .club-nav-item:focus-visible { outline: 2px solid var(--sk-brand); outline-offset: 1px; }
        .dashboard-root { height: 100dvh; overflow: hidden; }
        @media (min-width: 768px) { .dashboard-root { height: auto; min-height: 100vh; overflow: visible; } }
      `}</style>
    </div>
  );
}
