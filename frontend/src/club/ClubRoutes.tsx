import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { AuthPage, DashboardPage } from "./App";
import type { AuthTab } from "./App";
import { useAuth } from "../shared/AuthProvider";
import { destinationFor, setSession } from "../shared/session";
import type { SessionProfile } from "../shared/session";

/** /club/auth — club registration with an authorization key, club Google sign-in, club sign-in. */
export function ClubAuthRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTab = (params.get("tab") === "register" ? "register" : "login") as AuthTab;
  const [tab, setTab] = useState<AuthTab>(initialTab);
  return (
    <AuthPage
      tab={tab}
      onTabChange={setTab}
      onBack={() => navigate("/")}
      initialError={null}
      onLocalSignIn={(token: string, profile: SessionProfile) => {
        setSession(token, profile);
        navigate(destinationFor(profile.role, params.get("redirect")), { replace: true });
      }}
    />
  );
}

/** /club — the dashboard. Only reachable by a CLUB_HEAD (see RequireRole in the router). */
export function ClubDashboardRoute() {
  const { profile, signOut } = useAuth();
  return (
    <motion.div key="dash" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="dashboard-root">
      <DashboardPage
        userEmail={profile?.email ?? ""}
        onSignOut={signOut}
      />
    </motion.div>
  );
}
