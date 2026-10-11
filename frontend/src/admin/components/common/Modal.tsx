import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage } from '../../services/http';
import { useToast } from './Toast';
import { Spinner } from './ui';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;

/** Accessible dialog: Escape and backdrop close it, focus moves in, and the page behind does not scroll. */
export function Modal({ open, title, onClose, children, footer, width = 'md' }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`ad-card flex max-h-[92dvh] w-full ${widths[width]} flex-col rounded-b-none shadow-2xl sm:rounded-b-2xl`}>
        <div className="flex items-center justify-between border-b border-ad-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ad-muted hover:bg-ad-raised hover:text-ad-fg">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ad-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, the user must type this exact text before the action is enabled. */
  requireText?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/** Explicit confirmation for consequential actions (delete, archive, deactivate). */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, requireText, onConfirm, onClose }: ConfirmProps) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTyped('');
      setBusy(false);
    }
  }, [open]);

  const ready = !requireText || typed === requireText;
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      // Keep the dialog open so the user can retry or cancel; never fail silently.
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      width="sm"
      footer={
        <>
          <button className="ad-btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={danger ? 'ad-btn-primary' : 'ad-btn-primary'} onClick={run} disabled={!ready || busy}>
            {busy && <Spinner size={16} />} {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ad-muted">{message}</div>
      {requireText && (
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold text-ad-muted">
            Type <code className="rounded bg-ad-raised px-1.5 py-0.5 font-mono text-ad-fg">{requireText}</code> to confirm
          </label>
          <input className="ad-field" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
      )}
    </Modal>
  );
}
