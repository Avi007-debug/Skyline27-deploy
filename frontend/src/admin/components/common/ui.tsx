import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import type { ReactNode } from 'react';

export function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-ad-muted">
      <Spinner size={22} /> {label}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Inbox size={34} className="text-ad-faint" aria-hidden />
      <div className="font-semibold">{title}</div>
      {hint && <div className="max-w-sm text-sm text-ad-muted">{hint}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle size={30} className="text-ad-brand" aria-hidden />
      <div className="max-w-md text-sm text-ad-muted">{message}</div>
      {onRetry && (
        <button className="ad-btn-ghost ad-btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

const tones = {
  neutral: 'bg-ad-raised text-ad-muted border-ad-line',
  ok: 'bg-ad-ok/10 text-ad-ok border-ad-ok/30',
  warn: 'bg-ad-warn/10 text-ad-warn border-ad-warn/30',
  info: 'bg-ad-info/10 text-ad-info border-ad-info/30',
  bad: 'bg-ad-brand/10 text-ad-brand border-ad-brand/30',
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function StatCard({ label, value, sub, to }: { label: string; value: ReactNode; sub?: ReactNode; to?: string }) {
  const body = (
    <div className="ad-card h-full p-5 transition-colors hover:border-ad-faint">
      <div className="text-[11px] font-semibold tracking-normal text-ad-faint">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-ad-muted">{sub}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ad-muted">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ad-faint">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-ad-brand">
          {error}
        </span>
      )}
    </label>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ad-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
