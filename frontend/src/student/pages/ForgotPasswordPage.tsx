import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, MailCheck, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { forgotPassword } from '@/student/api/auth';
import { useTheme, ThemeToggle } from '@/shared/theme';

const FC = "var(--sk-font)";
const FM = "var(--sk-font)";
const FB = "var(--sk-font)";

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
        background: 'var(--sk-canvas)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Back button */}
      <Link
        to="/login"
        className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-sm transition-all duration-300 z-20 cursor-pointer"
        style={{ color: 'var(--sk-fg)', fontFamily: FB }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sk-fg)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#999999' : 'var(--sk-fg)')}
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
          className="w-full p-8 md:p-10 rounded-xl"
          style={{
            background: 'var(--sk-surface)',
            border: '1px solid var(--sk-line)',
            boxShadow: isDark ? 'none' : '0 20px 40px -15px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {message ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}
              >
                <MailCheck size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: FC, color: 'var(--sk-fg)' }}>
                Check your inbox
              </h2>
              <p className="text-xs leading-relaxed mb-6" style={{ fontFamily: FB, color: 'var(--sk-muted)' }}>
                {message} The reset link is valid for 1 hour.
              </p>
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center py-3 bg-[color:var(--sk-fg)] hover:opacity-90 text-[color:var(--sk-canvas)] text-sm font-semibold rounded-xl transition-all duration-300"
                style={{ fontFamily: FB }}
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                  style={{
                    background: 'var(--sk-surface)',
                    border: '1px solid var(--sk-line-strong)',
                  }}
                >
                  <Mail size={24} className="text-[color:var(--sk-fg)]" />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: FC, color: 'var(--sk-fg)' }}>
                  Reset Password
                </h2>
                <p className="text-xs" style={{ fontFamily: FB, color: 'var(--sk-muted)' }}>
                  Enter your registered student email and we'll send a link to reset your password.
                </p>
              </div>

              <form onSubmit={submit} noValidate className="space-y-6">
                <div className="space-y-1.5">
                  <label
                    className="text-[11px] tracking-normal block font-semibold"
                    style={{ fontFamily: FM, color: 'var(--sk-muted)' }}
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
                      background: 'var(--sk-surface)',
                      border: '1px solid var(--sk-line-strong)',
                      color: 'var(--sk-fg)',
                      fontFamily: FB,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sk-fg)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--sk-line)')}
                  />
                  {error && (
                    <p className="text-xs text-[color:var(--sk-brand)] font-medium mt-1" style={{ fontFamily: FB }}>
                      {error}
                    </p>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={busy}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[color:var(--sk-fg)] hover:opacity-90 text-[color:var(--sk-canvas)] text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 cursor-pointer"
                  style={{ fontFamily: FB }}
                >
                  {busy ? (
                    <div className="w-5 h-5 rounded-full border-2 border-[color:var(--sk-canvas)] border-t-transparent animate-spin" />
                  ) : (
                    <>
                      Send Reset Link <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </form>

              <p className="text-center text-xs mt-6" style={{ fontFamily: FB, color: 'var(--sk-muted)' }}>
                Remembered your password?{' '}
                <Link to="/login" className="text-[color:var(--sk-fg)] underline underline-offset-2 hover:opacity-80 font-semibold ml-1">
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
