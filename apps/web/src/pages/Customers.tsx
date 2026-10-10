import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { post } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { useAuth } from '../features/auth/AuthContext';
import { PageHead, Badge, Empty, Loading, Pager } from '../components/ui';

interface Row { _id: string; name: string; email: string; company?: string; status: string; }
const schema = z.object({ name: z.string().min(2), email: z.string().email(), company: z.string().optional(), phone: z.string().optional() });
type Form = z.infer<typeof schema>;

export function Customers(): JSX.Element {
  const { user } = useAuth();
  const canWrite = user?.role !== 'EMPLOYEE';
  const [search, setSearch] = useState('');
  const { rows, page, setPage, totalPages, loading, error, reload } = usePaged<Row>(`/customers?search=${encodeURIComponent(search)}`, search);
  const [msg, setMsg] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div>
      <PageHead title="Customers" sub="Search + pagination. Managers/admins can create." />
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="toolbar">
        <input className="input" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="grid cols-2">
        <div>
          {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : rows.length === 0 ? <Empty text="No customers." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Status</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={r._id}><td>{r.name}</td><td>{r.email}</td><td>{r.company ?? '—'}</td><td><Badge value={r.status} /></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
        {canWrite ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>New customer</h3>
            <form onSubmit={handleSubmit(async (v) => {
              try { await post('/customers', v); setMsg('Customer created.'); reset(); reload(); }
              catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
            })}>
              <div className="field"><label>Name</label><input className="input" {...register('name')} />{formState.errors.name ? <span className="err">{formState.errors.name.message}</span> : null}</div>
              <div className="field"><label>Email</label><input className="input" {...register('email')} />{formState.errors.email ? <span className="err">{formState.errors.email.message}</span> : null}</div>
              <div className="field"><label>Company</label><input className="input" {...register('company')} /></div>
              <div className="field"><label>Phone</label><input className="input" {...register('phone')} /></div>
              <button className="btn primary" disabled={formState.isSubmitting}>Create</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
