import { Download } from 'lucide-react';
import { useState } from 'react';
import { ClubSelect } from '../../components/common/ClubSelect';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, PageHeader, Spinner } from '../../components/common/ui';
import type { Tone } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { download, errorMessage, get, post } from '../../services/http';
import type { OrderRow, OrderStatus, Paginated } from '../../types/api';
import { formatDateTime, formatPaise, titleCase } from '../../utils/format';

const tone: Record<OrderStatus, Tone> = { PENDING_PAYMENT: 'warn', PAYMENT_SUBMITTED: 'info', PAID: 'ok', CANCELLED: 'neutral', REJECTED: 'bad' };

interface OrdersResponse extends Paginated<OrderRow> {
  summary: { paidOrders: number; grossSalesPaise: number };
}

export function OrdersPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<OrdersResponse['summary'] | null>(null);
  const q = usePagedQuery<OrderRow>({
    fetcher: async params => {
      const res = await get<OrdersResponse>('/merchandise/manage/orders', params);
      setSummary(res.summary);
      return res;
    },
    initialFilters: { status: undefined, clubId: undefined, from: undefined, to: undefined },
  });
  const [exporting, setExporting] = useState(false);
  const [rejecting, setRejecting] = useState<OrderRow | null>(null);

  const verify = async (o: OrderRow) => {
    try {
      await post(`/merchandise/manage/orders/${o.id}/verify`);
      toast.success('Payment verified and recorded in the ledger.');
      q.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await download('/merchandise/manage/orders.csv', { search: q.search, ...q.filters }, 'skyline_orders.csv');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Merchandise orders and payment verification."
        actions={<button className="ad-btn-ghost" onClick={exportCsv} disabled={exporting}>{exporting ? <Spinner size={15} /> : <Download size={15} />} Export CSV</button>}
      />
      {summary && (
        <p className="mb-4 text-sm text-ad-muted" aria-live="polite">
          <strong className="text-ad-fg">{summary.paidOrders}</strong> paid orders in this view · gross sales <strong className="text-ad-fg">{formatPaise(summary.grossSalesPaise)}</strong>
          <span className="text-ad-faint"> (revenue before costs, not profit)</span>
        </p>
      )}
      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search product, buyer, email or payment ref…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <select className="ad-field !w-auto" aria-label="Status" value={(q.filters.status as string) ?? ''} onChange={e => q.setFilter('status', e.target.value)}>
            <option value="">Any status</option>
            {(['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'CANCELLED', 'REJECTED'] as OrderStatus[]).map(s => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <ClubSelect value={(q.filters.clubId as string) ?? ''} onChange={v => q.setFilter('clubId', v)} />
          <label className="flex items-center gap-2 text-xs text-ad-muted">From <input type="date" className="ad-field !w-auto" value={(q.filters.from as string) ?? ''} onChange={e => q.setFilter('from', e.target.value)} /></label>
          <label className="flex items-center gap-2 text-xs text-ad-muted">To <input type="date" className="ad-field !w-auto" value={(q.filters.to as string) ?? ''} onChange={e => q.setFilter('to', e.target.value)} /></label>
        </Toolbar>
        <DataTable
          columns={[
            { header: 'Order', cell: o => (<div><div className="font-semibold">{o.productName}</div><div className="text-xs text-ad-faint">{o.variantLabel} × {o.quantity} · {o.club?.name}</div></div>) },
            { header: 'Buyer', cell: o => (<div><div>{o.buyerName}</div><div className="text-xs text-ad-faint">{o.buyerEmail}</div></div>) },
            { header: 'Total', cell: o => (<div><div className="font-semibold">{o.totalPaise === 0 ? 'Free' : formatPaise(o.totalPaise)}</div><div className="text-xs text-ad-faint">{formatPaise(o.unitPricePaise)} each</div></div>) },
            { header: 'Payment ref.', cell: o => o.transactionId ?? <span className="text-ad-faint">—</span> },
            { header: 'Status', cell: o => <Badge tone={tone[o.status]}>{titleCase(o.status)}</Badge> },
            { header: 'Placed', cell: o => formatDateTime(o.createdAt) },
            {
              header: '',
              cell: o => (
                <div className="flex justify-end gap-1.5">
                  {o.status === 'PAYMENT_SUBMITTED' && <button className="ad-btn-primary ad-btn-sm" onClick={() => verify(o)}>Verify</button>}
                  {(o.status === 'PAYMENT_SUBMITTED' || o.status === 'PENDING_PAYMENT') && <button className="ad-btn-danger ad-btn-sm" onClick={() => setRejecting(o)}>Reject</button>}
                </div>
              ),
            },
          ]}
          rows={q.items}
          rowKey={o => o.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          emptyTitle="No orders yet"
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this order?"
        message={rejecting ? `${rejecting.buyerName}'s order for ${rejecting.productName} is rejected and the reserved stock goes back on sale.` : ''}
        confirmLabel="Reject order"
        danger
        onConfirm={async () => {
          if (!rejecting) return;
          await post(`/merchandise/manage/orders/${rejecting.id}/reject`, { reason: 'Rejected by administrator' });
          toast.success('Order rejected and stock released.');
          q.refresh();
        }}
      />
    </>
  );
}
