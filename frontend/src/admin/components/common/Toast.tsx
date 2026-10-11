import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Consistent feedback for every mutation: success and failure are always shown, never swallowed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = next.current++;
    setToasts(t => [...t, { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);

  const api = useMemo<ToastApi>(() => ({ success: t => push('success', t), error: t => push('error', t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-ad-line bg-ad-raised px-4 py-3 text-sm shadow-xl">
            {t.kind === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ad-ok" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-ad-brand" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
