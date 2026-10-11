import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, MailCheck, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { forgotPassword } from '@/student/api/auth';
import { useTheme, ThemeToggle } from '@/shared/theme';

const FC = "'Playfair Display', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

/** Step 1 of recovery. The confirmation is the same whether or not the email has an account. */
export default function ForgotPasswordPage() {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      setMessage(await forgotPassword(email.trim()));
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
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
          {message ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}
              >
                <MailCheck size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: FC, color: isDark ? '#ffffff' : '#1e1b26' }}>
                Check your inbox
              </h2>
              <p className="text-xs leading-relaxed mb-6" style={{ fontFamily: FB, color: isDark ? '#d1d5db' : '#64748b' }}>
                {message} The reset link is valid for 1 hour.
              </p>
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center py-3 bg-[#F03D4E] hover:bg-[#d63545] text-white text-sm font-semibold rounded-xl transition-all duration-300"
                style={{ fontFamily: FB }}
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{
                    background: 'rgba(240,61,78,0.1)',
                    border: '1px solid rgba(240,61,78,0.2)',
                  }}
                >
                  <Mail size={24} className="text-[#F03D4E]" />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: FC, color: isDark ? '#ffffff' : '#1e1b26' }}>
                  Reset Password
                </h2>
                <p className="text-xs" style={{ fontFamily: FB, color: isDark ? '#d1d5db' : '#64748b' }}>
                  Enter your registered student email and we'll send a link to reset your password.
                </p>
              </div>

              <form onSubmit={submit} noValidate className="space-y-6">
                <div className="space-y-1.5">
                  <label
                    className="text-[11px] uppercase tracking-widest block font-semibold"
                    style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your student email"
                    autoComplete="email"
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
                  {error && (
                    <p className="text-xs text-[#F03D4E] font-medium mt-1" style={{ fontFamily: FB }}>
                      {error}
                    </p>
                  )}
                </div>

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
                      Send Reset Link <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </form>

              <p className="text-center text-xs mt-6" style={{ fontFamily: FB, color: isDark ? '#999999' : '#64748b' }}>
                Remembered your password?{' '}
                <Link to="/login" className="text-[#F03D4E] hover:underline font-semibold ml-1">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
