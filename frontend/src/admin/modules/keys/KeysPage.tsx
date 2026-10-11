import { Check, Copy, KeyRound, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, Field, PageHeader, Spinner } from '../../components/common/ui';
import type { Tone } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { del, errorMessage, get, post } from '../../services/http';
import type { KeyRow, Paginated } from '../../types/api';
import { formatDateTime, titleCase } from '../../utils/format';

const tone: Record<KeyRow['status'], Tone> = { AVAILABLE: 'ok', USED: 'neutral', EXPIRED: 'warn' };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const toast = useToast();
  return (
    <button
      className="ad-btn-ghost ad-btn-sm"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } else {
          toast.error('Copy is blocked by the browser. Select the key and copy it manually.');
        }
      }}
    >
      {done ? <Check size={14} className="text-ad-ok" /> : <Copy size={14} />} {done ? 'Copied' : label}
    </button>
  );
}

export function KeysPage() {
  const toast = useToast();
  const q = usePagedQuery<KeyRow>({
    fetcher: params => get<Paginated<KeyRow>>('/admin/registration-keys', params),
    initialFilters: { status: undefined },
  });

  const [customCode, setCustomCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // The key returned by the generate call itself — shown exactly as created, never re-derived from a list.
  const [created, setCreated] = useState<KeyRow | null>(null);
  const [revoking, setRevoking] = useState<KeyRow | null>(null);

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {};
      if (customCode.trim()) body.customCode = customCode.trim();
      if (expiresInDays) body.expiresInDays = Number(expiresInDays);
      const res = await post<{ key: KeyRow }>('/admin/registration-keys/generate', body);
      setCreated(res.key);
      setCustomCode('');
      toast.success('Registration key generated.');
      q.refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PageHeader title="Registration keys" subtitle="Single-use codes that let a new club register itself." />

      <section className="ad-card mb-6 p-5" aria-label="Generate a key">
        <form onSubmit={generate} className="grid items-end gap-4 sm:grid-cols-[1fr_180px_auto]" noValidate>
          <Field label="Custom code (optional)" hint="Leave empty for a secure random SKYLINE-XXXX-XXXX key.">
            <input className="ad-field font-mono uppercase" value={customCode} onChange={e => setCustomCode(e.target.value)} placeholder="e.g. WELCOME-2026" maxLength={32} />
          </Field>
          <Field label="Expires after (days)" hint="Empty = never">
            <input className="ad-field" type="number" min={1} max={365} value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} />
          </Field>
          <button className="ad-btn-primary" disabled={generating}>
            {generating ? <Spinner size={16} /> : <Sparkles size={16} />} Generate key
          </button>
        </form>
        {formError && <p role="alert" className="mt-3 text-sm text-ad-brand">{formError}</p>}

        {created && (
          <div role="status" className="mt-5 rounded-2xl border border-ad-brand/40 bg-ad-brand/10 p-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ad-brand">
              <KeyRound size={14} /> New key — share it with the club
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <code data-testid="generated-key" className="select-all break-all font-mono text-2xl font-bold tracking-wider">{created.code}</code>
              <CopyButton text={created.code} label="Copy key" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ad-muted">
              <Badge tone={tone[created.status]}>{titleCase(created.status)}</Badge>
              <span>Created {formatDateTime(created.createdAt)}</span>
              <span>{created.expiresAt ? `Expires ${formatDateTime(created.expiresAt)}` : 'Never expires'}</span>
              <span>Single use</span>
            </div>
          </div>
        )}
      </section>

      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search key or club…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <select className="ad-field !w-auto" aria-label="Status" value={(q.filters.status as string) ?? ''} onChange={e => q.setFilter('status', e.target.value)}>
            <option value="">Any status</option>
            <option value="AVAILABLE">Available</option>
            <option value="USED">Used</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </Toolbar>
        <DataTable
          columns={[
            { header: 'Key', cell: k => <code className="font-mono text-sm font-semibold">{k.code}</code> },
            { header: 'Status', cell: k => <Badge tone={tone[k.status]}>{titleCase(k.status)}</Badge> },
            { header: 'Used by', cell: k => (k.usedByClub ? <div><div className="font-semibold">{k.usedByClub.name}</div><div className="text-xs text-ad-faint">{k.usedByClub.email}</div></div> : <span className="text-ad-faint">—</span>) },
            { header: 'Created', cell: k => formatDateTime(k.createdAt) },
            { header: 'Expires', cell: k => (k.expiresAt ? formatDateTime(k.expiresAt) : 'Never') },
            {
              header: '',
              cell: k => (
                <div className="flex justify-end gap-1.5">
                  <CopyButton text={k.code} />
                  {!k.isUsed && <button className="ad-btn-danger ad-btn-sm" onClick={() => setRevoking(k)}>Revoke</button>}
                </div>
              ),
            },
          ]}
          rows={q.items}
          rowKey={k => k.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          emptyTitle="No keys yet"
          emptyHint="Generate a key above to invite a new club."
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke this key?"
        message={revoking ? <>The key <code className="font-mono text-ad-fg">{revoking.code}</code> will stop working immediately.</> : ''}
        confirmLabel="Revoke"
        danger
        onConfirm={async () => {
          if (!revoking) return;
          await del(`/admin/registration-keys/${revoking.id}`);
          toast.success('Key revoked.');
          if (created?.id === revoking.id) setCreated(null);
          q.refresh();
        }}
      />
    </>
  );
}
