import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { App } from "./app/App";
import { ThemeProvider } from "./shared/theme";
import { AuthProvider } from "./shared/AuthProvider";
import { ErrorBoundary } from "./club/components/ErrorBoundary";
import "./styles/index.css";

if (import.meta.env.PROD) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
