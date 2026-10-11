import { useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router';
import { Eye, EyeOff, ChevronLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login, signup } from '@/student/api/auth';
import { setSession, destinationFor as sharedDestinationFor } from '@/shared/session';
import type { Role } from '@/shared/session';
import { useUserStore } from '@/student/store/userStore';
import { isProfileIncomplete } from '@/student/types/user';
import { toast } from 'sonner';
import { useTheme, ThemeToggle } from '@/shared/theme';

const FC = "'Playfair Display', serif";
const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
  usn: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/.test(v.toUpperCase()),
      'Enter a valid USN (e.g. 1AB23CD456)'
    ),
  branch: z.string().optional(),
  phone: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

const BRANCHES = ['CS', 'IS', 'EC', 'ME', 'CV', 'EE', 'AI', 'BT', 'Other'];

export default function AuthPage() {
  const { isDark } = useTheme();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(location.pathname !== '/signup');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('redirect');
  const destinationFor = (role: Role): string => sharedDestinationFor(role, requested);
  const [serverError, setServerError] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', usn: '', branch: '', phone: '' },
  });

  const { setCurrentUser } = useUserStore();

  const isServerError = (msg: string) =>
    msg.includes('unexpected server error') ||
    msg.includes('Connection error') ||
    msg.includes('try again later');

  const handleLogin = loginForm.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const result = await login(data);
      setSession(result.token, result.profile);
      setCurrentUser(result.user);
      if (result.role === 'STUDENT' && isProfileIncomplete(result.user)) {
        navigate(`/onboarding?redirect=${encodeURIComponent(destinationFor(result.role))}`, { replace: true });
      } else {
        navigate(destinationFor(result.role), { replace: true });
      }
    } catch (e) {
      const msg = String(e).replace('Error: ', '');
      if (isServerError(msg)) {
        setServerError(msg);
      } else {
        toast.error(msg);
      }
    }
  });

  const handleSignup = signupForm.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const result = await signup({
        ...data,
        usn: data.usn?.toUpperCase() || undefined,
      });
      setSession(result.token, result.profile);
      setCurrentUser(result.user);
      if (isProfileIncomplete(result.user)) {
        navigate(`/onboarding?redirect=${encodeURIComponent(destinationFor('STUDENT'))}`, { replace: true });
      } else {
        navigate(destinationFor('STUDENT'), { replace: true });
      }
    } catch (e) {
      const msg = String(e).replace('Error: ', '');
      if (isServerError(msg)) {
        setServerError(msg);
      } else {
        toast.error(msg);
      }
    }
  });

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
      {/* Top Left Back Navigation */}
      <Link
        to="/"
        className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-sm transition-all duration-300 z-20 cursor-pointer"
        style={{ color: isDark ? '#d1d5db' : '#1e1b26', fontFamily: FB }}
        onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#eeeeee' : '#F03D4E')}
        onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#999999' : '#1e1b26')}
      >
        <ChevronLeft size={16} /> Back
      </Link>

      {/* Top Right Theme Toggle */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-20">
        <ThemeToggle />
      </div>

      {/* Main Centered Content */}
      <div className="flex flex-col items-center gap-6 w-full max-w-md my-auto relative z-10 py-10">
        {/* Pill Tab Switcher */}
        <div
          className="flex gap-1 p-1 rounded-xl w-full relative"
          style={{
            background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)',
            border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {[
            { id: 'login', label: 'Sign In' },
            { id: 'signup', label: 'Sign Up' },
          ].map((t) => {
            const active = (t.id === 'login' && isLogin) || (t.id === 'signup' && !isLogin);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setIsLogin(t.id === 'login');
                  setServerError(null);
                }}
                className="relative flex-1 py-2.5 text-sm font-medium transition-colors duration-300 cursor-pointer"
                style={{ fontFamily: FB }}
              >
                {active && (
                  <motion.div
                    layoutId="activeStudentAuthTabPill"
                    className={`absolute inset-0 rounded-lg ${
                      isDark ? 'bg-white shadow-sm' : 'bg-white shadow-sm border border-black/5'
                    }`}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  />
                )}
                <span
                  className={`relative z-10 transition-colors duration-300 font-semibold ${
                    active
                      ? 'text-[#1e1b26]'
                      : isDark
                      ? 'text-[#aaaaaa] hover:text-white'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Glass Card */}
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
          <AnimatePresence mode="popLayout">
            <motion.div
              key={isLogin ? 'login' : 'signup'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-center mb-8">
                <h2
                  className="text-2xl font-bold mb-2"
                  style={{ fontFamily: FC, color: isDark ? '#ffffff' : '#1e1b26' }}
                >
                  {isLogin ? 'Sign In as Student' : 'Register as Student'}
                </h2>
                <p
                  className="text-xs"
                  style={{ fontFamily: FB, color: isDark ? '#d1d5db' : '#64748b' }}
                >
                  {isLogin
                    ? 'Access your student campus dashboard'
                    : 'Welcome! Please fill in the details to get started.'}
                </p>
              </div>

              {serverError && (
                <div
                  className="p-3 mb-6 rounded-xl text-center text-xs text-[#F03D4E] font-medium"
                  style={{
                    background: 'rgba(240,61,78,0.08)',
                    border: '1px solid rgba(240,61,78,0.2)',
                    fontFamily: FB,
                  }}
                >
                  {serverError}
                </div>
              )}

              {isLogin ? (
                /* LOGIN FORM */
                <form noValidate onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-1.5">
                    <label
                      className="text-[11px] uppercase tracking-widest block font-semibold"
                      style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                    >
                      Email ID
                    </label>
                    <input
                      {...loginForm.register('email')}
                      type="email"
                      placeholder="Enter your email address"
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
                    {loginForm.formState.errors.email && (
                      <p className="text-xs text-[#F03D4E] font-medium mt-1" style={{ fontFamily: FB }}>
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
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
                        {...loginForm.register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        autoComplete="current-password"
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
                    {loginForm.formState.errors.password && (
                      <p className="text-xs text-[#F03D4E] font-medium mt-1" style={{ fontFamily: FB }}>
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
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

                  <motion.button
                    type="submit"
                    disabled={loginForm.formState.isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#F03D4E] hover:bg-[#d63545] text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#F03D4E]/20"
                    style={{ fontFamily: FB }}
                  >
                    {loginForm.formState.isSubmitting ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <>
                        Continue <ArrowRight size={14} />
                      </>
                    )}
                  </motion.button>
                </form>
              ) : (
                /* SIGNUP FORM */
                <form noValidate onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      className="text-[11px] uppercase tracking-widest block font-semibold"
                      style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                    >
                      Full Name
                    </label>
                    <input
                      {...signupForm.register('name')}
                      type="text"
                      placeholder="e.g. John Doe"
                      autoComplete="name"
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
                    {signupForm.formState.errors.name && (
                      <p className="text-xs text-[#F03D4E] font-medium mt-1" style={{ fontFamily: FB }}>
                        {signupForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="text-[11px] uppercase tracking-widest block font-semibold"
                      style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                    >
                      Email ID
                    </label>
                    <input
                      {...signupForm.register('email')}
                      type="email"
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
                    {signupForm.formState.errors.email && (
                      <p className="text-xs text-[#F03D4E] font-medium mt-1" style={{ fontFamily: FB }}>
                        {signupForm.formState.errors.email.message}
                      </p>
                    )}
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
                        {...signupForm.register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 8 chars with letter & number"
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
                    {signupForm.formState.errors.password && (
                      <p className="text-xs text-[#F03D4E] font-medium mt-1" style={{ fontFamily: FB }}>
                        {signupForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="text-[11px] uppercase tracking-widest block font-semibold"
                      style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                    >
                      USN (Optional)
                    </label>
                    <input
                      {...signupForm.register('usn')}
                      type="text"
                      placeholder="e.g. 1AB23CD456"
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all uppercase tracking-wider"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.02)' : '#e4e7ee',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                        color: isDark ? '#ffffff' : '#1e1b26',
                        fontFamily: FM,
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.3)' : '#F03D4E')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)')}
                    />
                    {signupForm.formState.errors.usn && (
                      <p className="text-xs text-[#F03D4E] font-medium mt-1" style={{ fontFamily: FB }}>
                        {signupForm.formState.errors.usn.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label
                        className="text-[11px] uppercase tracking-widest block font-semibold"
                        style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                      >
                        Branch
                      </label>
                      <select
                        {...signupForm.register('branch')}
                        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all cursor-pointer"
                        style={{
                          background: isDark ? '#141418' : '#e4e7ee',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                          color: isDark ? '#ffffff' : '#1e1b26',
                          fontFamily: FB,
                        }}
                      >
                        <option value="" style={{ background: isDark ? '#141418' : '#fff', color: isDark ? '#fff' : '#1e1b26' }}>Select</option>
                        {BRANCHES.map((b) => (
                          <option key={b} value={b} style={{ background: isDark ? '#141418' : '#fff', color: isDark ? '#fff' : '#1e1b26' }}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-[11px] uppercase tracking-widest block font-semibold"
                        style={{ fontFamily: FM, color: isDark ? '#f3f4f6' : '#475569' }}
                      >
                        Phone
                      </label>
                      <input
                        {...signupForm.register('phone')}
                        type="tel"
                        placeholder="10-digit number"
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
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ fontFamily: FB, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>
                    By signing up you agree to our{' '}
                    <Link to="/privacy" className="text-[#F03D4E] hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </p>

                  <motion.button
                    type="submit"
                    disabled={signupForm.formState.isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#F03D4E] hover:bg-[#d63545] text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#F03D4E]/20"
                    style={{ fontFamily: FB }}
                  >
                    {signupForm.formState.isSubmitting ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <>
                        Create Account <ArrowRight size={14} />
                      </>
                    )}
                  </motion.button>
                </form>
              )}

              {/* Bottom Mode Switch */}
              <p className="text-center text-xs mt-6" style={{ fontFamily: FB, color: isDark ? '#999999' : '#64748b' }}>
                {isLogin ? "Don't have a student account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setServerError(null);
                  }}
                  className="text-[#F03D4E] hover:underline font-semibold ml-1 cursor-pointer"
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
