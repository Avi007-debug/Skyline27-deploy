import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ChevronLeft, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import logo from '../../assets/logo.png';
import { API_BASE } from '@/shared/config';
import { destinationFor, setSession } from '@/shared/session';
import type { SessionProfile } from '@/shared/session';
import { useTheme, ThemeToggle } from '@/shared/theme';

const FC = "'Playfair Display', serif";
const F_LOGO = "'Cinzel', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

/**
 * Super admin sign-in (/admin/login). Admin accounts are created by the
 * platform owner, so there is no sign-up here. The server only accepts
 * SUPER_ADMIN accounts on this endpoint.
 */
export default function AdminLogin() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (res.status === 429 ? 'Too many attempts. Please wait a moment.' : 'Sign in failed.'));
        return;
      }
      setSession(data.token as string, data.profile as SessionProfile);
      navigate(destinationFor('SUPER_ADMIN', params.get('redirect')), { replace: true });
    } catch {
      setError('Cannot reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden"
      style={{
        background: isDark ? 'rgba(5,5,5,0.97)' : '#f0f2f6',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Back button */}
      <Link
        to="/"
        className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-sm transition-all duration-300 z-20 cursor-pointer"
        style={{ color: isDark ? '#d1d5db' : '#1e1b26', fontFamily: FB }}
        onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#eeeeee' : '#F03D4E')}
        onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#999999' : '#1e1b26')}
      >
        <ChevronLeft size={16} /> Back
      </Link>

      {/* Theme toggle */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-20">
        <ThemeToggle />
      </div>

      {/* Glass card */}
      <div className="w-full max-w-md my-auto relative z-10 py-10">
        <div
          className="w-full p-8 md:p-10 rounded-3xl"
          style={{
            background: isDark ? 'rgba(255,255,255,0.015)' : '#f0f2f6',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: isDark ? 'none' : '0 20px 40px -15px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-4">
              <img src={logo} alt="SkylineOS" className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-black/20" />
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#F03D4E] text-white shadow-sm">
                <ShieldCheck size={13} />
              </div>
            </div>
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#F03D4E] mb-1.5"
              style={{ fontFamily: F_LOGO }}
            >
              Super Admin
            </div>
            <h1
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: FC, color: isDark ? '#ffffff' : '#1e1b26' }}
            >
              Admin Sign In
            </h1>
            <p
              className="text-xs"
              style={{ fontFamily: FB, color: isDark ? '#d1d5db' : '#64748b' }}
            >
              Platform administration & governance for SkylineOS
            </p>
          </div>

          <form onSubmit={submit} noValidate className="space-y-6">
            <div className="space-y-1.5">
              <label
                className="text-[11px] uppercase tracking-widest block font-semibold"
                style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
              >
                Admin Email
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@skylineos.internal"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : '#e4e7ee',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                  color: isDark ? '#ffffff' : '#1e1b26',
                  fontFamily: FB,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.3)' : '#F03D4E')}
                onBlur={(e) => (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)')}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11px] uppercase tracking-widest block font-semibold"
                style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full rounded-xl pl-4 pr-12 py-3 text-sm outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#e4e7ee',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                    color: isDark ? '#ffffff' : '#1e1b26',
                    fontFamily: FB,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.3)' : '#F03D4E')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-white/65 dark:hover:text-white transition-colors bg-transparent border-0 outline-none p-1 cursor-pointer flex items-center justify-center"
                  style={{ background: 'transparent', border: 'none' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-1.5">
              <Link
                to="/forgot-password"
                className="text-[11px] transition-colors cursor-pointer underline-offset-2"
                style={{
                  fontFamily: FB,
                  color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F03D4E')}
                onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.4)' : '#64748b')}
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div
                className="p-3 rounded-xl text-center text-xs text-[#F03D4E] font-medium"
                style={{
                  background: 'rgba(240,61,78,0.08)',
                  border: '1px solid rgba(240,61,78,0.2)',
                  fontFamily: FB,
                }}
              >
                {error}
              </div>
            )}

            <motion.button
              type="submit"
              disabled={busy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#F03D4E] hover:bg-[#d63545] text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#F03D4E]/20"
              style={{ fontFamily: FB }}
            >
              {busy ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  Sign In to Console <ArrowRight size={14} />
                </>
              )}
            </motion.button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
