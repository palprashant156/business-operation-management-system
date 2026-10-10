import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { post } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { useAuth } from '../features/auth/AuthContext';
import { PageHead, Badge, Empty, Loading, Pager } from '../components/ui';

interface Row { _id: string; name: string; sku: string; price: number; stockQuantity: number; status: string; }
const schema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  price: z.coerce.number().min(0, 'Price must be non-negative.'),
  stockQuantity: z.coerce.number().int().min(0, 'Stock must be non-negative.'),
  description: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function Products(): JSX.Element {
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const { rows, page, setPage, totalPages, loading, error, reload } = usePaged<Row>(`/products?search=${encodeURIComponent(search)}`, search);
  const [msg, setMsg] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div>
      <PageHead title="Products" sub="SKU unique. Prices validated server-side; orders snapshot the price." />
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="toolbar">
        <input className="input" placeholder="Search name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="grid cols-2">
        <div>
          {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : rows.length === 0 ? <Empty text="No products." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={r._id}><td>{r.name}</td><td>{r.sku}</td><td>${r.price.toFixed(2)}</td><td>{r.stockQuantity}</td><td><Badge value={r.status} /></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
        {canWrite ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>New product (admin)</h3>
            <form onSubmit={handleSubmit(async (v) => {
              try { await post('/products', v); setMsg('Product created.'); reset(); reload(); }
              catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
            })}>
              <div className="field"><label>Name</label><input className="input" {...register('name')} />{formState.errors.name ? <span className="err">{formState.errors.name.message}</span> : null}</div>
              <div className="field"><label>SKU</label><input className="input" {...register('sku')} />{formState.errors.sku ? <span className="err">{formState.errors.sku.message}</span> : null}</div>
              <div className="field"><label>Price</label><input className="input" type="number" step="0.01" {...register('price')} />{formState.errors.price ? <span className="err">{formState.errors.price.message}</span> : null}</div>
              <div className="field"><label>Stock</label><input className="input" type="number" {...register('stockQuantity')} />{formState.errors.stockQuantity ? <span className="err">{formState.errors.stockQuantity.message}</span> : null}</div>
              <button className="btn primary" disabled={formState.isSubmitting}>Create</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
