import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { post, patch } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { PageHead, Badge, Empty, Loading, Pager } from '../components/ui';

interface Item { productName: string; quantity: number; unitPrice: number; lineTotal: number; }
interface Row { _id: string; orderNumber: string; status: string; subtotal: number; customerId: { name: string } | string; items: Item[]; }

const schema = z.object({
  customerId: z.string().min(1, 'Customer id required.'),
  productId: z.string().min(1, 'Product id required.'),
  quantity: z.coerce.number().int().min(1).max(1000),
});
type Form = z.infer<typeof schema>;

const ORDER_NEXT: Record<string, string[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function Orders(): JSX.Element {
  const [status, setStatus] = useState('');
  const { rows, page, setPage, totalPages, loading, error, reload } = usePaged<Row>(`/orders?${status ? `status=${status}&` : ''}limit=15`, status);
  const [msg, setMsg] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div>
      <PageHead title="Orders" sub="Server snapshots product name + price. Totals never trusted from client." />
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="toolbar">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter orders">
          <option value="">All</option>
          <option value="DRAFT">DRAFT</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>
      <div className="grid cols-2">
        <div>
          {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : rows.length === 0 ? <Empty text="No orders." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Number</th><th>Customer</th><th>Total</th><th>Status</th><th>Next</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td>{r.orderNumber}</td>
                      <td>{typeof r.customerId === 'object' ? r.customerId.name : ''}</td>
                      <td>${r.subtotal.toFixed(2)}</td>
                      <td><Badge value={r.status} /></td>
                      <td>
                        {(ORDER_NEXT[r.status] ?? []).map((n) => (
                          <button key={n} className="btn small" style={{ marginRight: 6 }} onClick={() => {
                            patch(`/orders/${r._id}/status`, { status: n }).then(() => { setMsg(`Order → ${n}`); reload(); }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : 'Rejected.'));
                          }}>{n}</button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>New order (single line for MVP)</h3>
          <form onSubmit={handleSubmit(async (v) => {
            try {
              await post('/orders', { customerId: v.customerId, items: [{ productId: v.productId, quantity: v.quantity }] });
              setMsg('Order created with price snapshot; stock decremented.'); reset(); reload();
            } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
          })}>
            <div className="field"><label>Customer id</label><input className="input" {...register('customerId')} />{formState.errors.customerId ? <span className="err">{formState.errors.customerId.message}</span> : null}</div>
            <div className="field"><label>Product id</label><input className="input" {...register('productId')} />{formState.errors.productId ? <span className="err">{formState.errors.productId.message}</span> : null}</div>
            <div className="field"><label>Quantity</label><input className="input" type="number" {...register('quantity')} />{formState.errors.quantity ? <span className="err">{formState.errors.quantity.message}</span> : null}</div>
            <button className="btn primary" disabled={formState.isSubmitting}>Create order</button>
          </form>
        </div>
      </div>
    </div>
  );
}
