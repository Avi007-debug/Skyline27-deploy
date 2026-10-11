import { Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useToast } from '../../components/common/Toast';
import { ErrorState, PageHeader, PageLoader, Spinner } from '../../components/common/ui';
import { download, errorMessage, get } from '../../services/http';
import { formatNumber, formatPaise } from '../../utils/format';

interface Summary {
  range: { from: string | null; to: string | null };
  clubs: Array<{ clubId: string; club: string; confirmed: number; pending: number; grossSalesInr: number }>;
  events: Array<{ eventId: string; event: string; club: string; confirmed: number; pending: number; rejected: number; grossSalesInr: number }>;
  merchandise: { paidOrders: number; grossSalesPaise: number };
  note: string;
}

const inr = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Registration and sales-revenue summaries for a date range. These are gross sales, not profit. */
export function ReportsPage() {
  const toast = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    get<Summary>('/admin/reports/summary', { from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59` : undefined })
      .then(setData)
      .catch(e => setError(errorMessage(e, 'Could not build the report.')))
      .finally(() => setLoading(false));
  }, [from, to]);
  useEffect(load, [load]);

  const exportFile = async (kind: 'registrations' | 'orders') => {
    setExporting(kind);
    try {
      const range = { from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59` : undefined };
      if (kind === 'registrations') await download('/admin/reports/registrations.csv', range, 'skyline_registrations.csv');
      else await download('/merchandise/manage/orders.csv', range, 'skyline_orders.csv');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(null);
    }
  };

  const totals = data?.clubs.reduce((t, c) => ({ confirmed: t.confirmed + c.confirmed, pending: t.pending + c.pending, sales: t.sales + c.grossSalesInr }), { confirmed: 0, pending: 0, sales: 0 });

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Registrations and gross sales by club and event."
        actions={
          <>
            <button className="ad-btn-ghost" onClick={() => exportFile('registrations')} disabled={!!exporting}>{exporting === 'registrations' ? <Spinner size={15} /> : <Download size={15} />} Registrations CSV</button>
            <button className="ad-btn-ghost" onClick={() => exportFile('orders')} disabled={!!exporting}>{exporting === 'orders' ? <Spinner size={15} /> : <Download size={15} />} Orders CSV</button>
          </>
        }
      />
      <div className="ad-card mb-6 flex flex-wrap items-end gap-4 p-4">
        <label className="text-xs font-semibold text-ad-muted">From<input type="date" className="ad-field mt-1.5" value={from} onChange={e => setFrom(e.target.value)} max={to || undefined} /></label>
        <label className="text-xs font-semibold text-ad-muted">To<input type="date" className="ad-field mt-1.5" value={to} onChange={e => setTo(e.target.value)} min={from || undefined} /></label>
        {(from || to) && <button className="ad-btn-ghost ad-btn-sm mb-0.5" onClick={() => { setFrom(''); setTo(''); }}>All time</button>}
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <PageLoader /> : (
        <div style={{ opacity: loading ? 0.6 : 1 }} aria-busy={loading}>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Tile label="Confirmed registrations" value={formatNumber(totals?.confirmed ?? 0)} sub={`${totals?.pending ?? 0} pending`} />
            <Tile label="Ticket sales (gross)" value={inr(totals?.sales ?? 0)} sub="Confirmed registrations × fee" />
            <Tile label="Merchandise sales (gross)" value={formatPaise(data.merchandise.grossSalesPaise)} sub={`${data.merchandise.paidOrders} paid orders`} />
          </div>

          <Section title="By club">
            <table className="w-full min-w-[480px] border-collapse">
              <thead><tr className="border-b border-ad-line"><th className="ad-th">Club</th><th className="ad-th text-right">Confirmed</th><th className="ad-th text-right">Pending</th><th className="ad-th text-right">Ticket sales</th></tr></thead>
              <tbody>
                {data.clubs.length === 0 && <tr><td className="ad-td text-ad-muted" colSpan={4}>No registrations in this period.</td></tr>}
                {data.clubs.map(c => (
                  <tr key={c.clubId} className="border-b border-ad-line/60 last:border-0">
                    <td className="ad-td font-semibold"><Link to={`/admin/clubs/${c.clubId}`} className="hover:text-ad-brand">{c.club}</Link></td>
                    <td className="ad-td text-right">{c.confirmed}</td><td className="ad-td text-right">{c.pending}</td><td className="ad-td text-right">{inr(c.grossSalesInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="By event">
            <table className="w-full min-w-[560px] border-collapse">
              <thead><tr className="border-b border-ad-line"><th className="ad-th">Event</th><th className="ad-th">Club</th><th className="ad-th text-right">Confirmed</th><th className="ad-th text-right">Pending</th><th className="ad-th text-right">Rejected</th><th className="ad-th text-right">Ticket sales</th></tr></thead>
              <tbody>
                {data.events.length === 0 && <tr><td className="ad-td text-ad-muted" colSpan={6}>No registrations in this period.</td></tr>}
                {data.events.map(e => (
                  <tr key={e.eventId} className="border-b border-ad-line/60 last:border-0">
                    <td className="ad-td font-semibold"><Link to={`/admin/events/${e.eventId}`} className="hover:text-ad-brand">{e.event}</Link></td>
                    <td className="ad-td text-ad-muted">{e.club}</td>
                    <td className="ad-td text-right">{e.confirmed}</td><td className="ad-td text-right">{e.pending}</td><td className="ad-td text-right">{e.rejected}</td><td className="ad-td text-right">{inr(e.grossSalesInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <p className="mt-4 text-xs text-ad-faint">{data.note}</p>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ad-card p-5">
      <div className="text-[11px] font-semibold tracking-normal text-ad-faint">{label}</div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs text-ad-muted">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ad-card mb-6">
      <h2 className="border-b border-ad-line px-5 py-4 font-bold">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
