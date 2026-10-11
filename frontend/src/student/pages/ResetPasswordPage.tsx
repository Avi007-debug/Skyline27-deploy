import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ChevronLeft, ShieldAlert, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { resetPassword, validateResetToken } from '@/student/api/auth';
import { useTheme, ThemeToggle } from '@/shared/theme';

const FC = "'Playfair Display', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

function passwordProblem(p: string): string | null {
  if (p.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Include at least one letter and one number.';
  return null;
}

/** Step 2 of recovery: opened from the emailed link (?token=...&email=...). */
export default function ResetPasswordPage() {
  const { isDark } = useTheme();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setStatus('invalid');
      return;
    }
    validateResetToken(token, email).then((ok) => setStatus(ok ? 'valid' : 'invalid'));
  }, [token, email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await resetPassword(token, email, password);
      toast.success('Password updated. Please sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = String(err).replace('Error: ', '');
      setError(msg);
      if (/invalid|expired/i.test(msg)) setStatus('invalid');
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
        to="/login"
        className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-sm transition-all duration-300 z-20 cursor-pointer"
        style={{ color: isDark ? '#d1d5db' : '#1e1b26', fontFamily: FB }}
        onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#eeeeee' : '#F03D4E')}
        onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#999999' : '#1e1b26')}
      >
        <ChevronLeft size={16} /> Back to Sign In
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
          {status === 'checking' && (
            <div className="text-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#F03D4E] border-t-transparent animate-spin mx-auto mb-4" />
              <p style={{ fontFamily: FB, color: isDark ? '#999' : '#64748b' }}>Verifying your reset link...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: 'rgba(240,61,78,0.1)',
                  border: '1px solid rgba(240,61,78,0.2)',
                }}
              >
                <ShieldAlert size={28} className="text-[#F03D4E]" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: FC, color: isDark ? '#ffffff' : '#1e1b26' }}>
                Link Expired or Invalid
              </h2>
              <p className="text-xs leading-relaxed mb-6" style={{ fontFamily: FB, color: isDark ? '#d1d5db' : '#64748b' }}>
                Reset links are single-use and expire after 1 hour. Please request a new link to continue.
              </p>
              <Link
                to="/forgot-password"
                className="w-full inline-flex items-center justify-center py-3 bg-[#F03D4E] hover:bg-[#d63545] text-white text-sm font-semibold rounded-xl transition-all duration-300"
                style={{ fontFamily: FB }}
              >
                Request New Link
              </Link>
            </div>
          )}

          {status === 'valid' && (
            <>
              <div className="text-center mb-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{
                    background: 'rgba(240,61,78,0.1)',
                    border: '1px solid rgba(240,61,78,0.2)',
                  }}
                >
                  <KeyRound size={24} className="text-[#F03D4E]" />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: FC, color: isDark ? '#ffffff' : '#1e1b26' }}>
                  Create New Password
                </h2>
                <p className="text-xs" style={{ fontFamily: FB, color: isDark ? '#d1d5db' : '#64748b' }}>
                  Resetting password for <span className="font-semibold text-[#F03D4E]">{email}</span>
                </p>
              </div>

              <form onSubmit={submit} noValidate className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    className="text-[11px] uppercase tracking-widest block font-semibold"
                    style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters, letters and numbers"
                      autoComplete="new-password"
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

                <div className="space-y-1.5">
                  <label
                    className="text-[11px] uppercase tracking-widest block font-semibold"
                    style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                  >
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat the new password"
                    autoComplete="new-password"
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

                {error && (
                  <p className="text-xs text-[#F03D4E] font-medium" style={{ fontFamily: FB }}>
                    {error}
                  </p>
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
                      Update Password <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </form>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
