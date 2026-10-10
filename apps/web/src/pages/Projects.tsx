import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { post } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { useAuth } from '../features/auth/AuthContext';
import { PageHead, Badge, Empty, Loading, Pager } from '../components/ui';

interface Row { _id: string; name: string; status: string; ownerId: { name: string } | string; dueDate?: string; }
const schema = z.object({ name: z.string().min(2), description: z.string().optional() });
type Form = z.infer<typeof schema>;

export function Projects(): JSX.Element {
  const { user } = useAuth();
  const canCreate = user?.role !== 'EMPLOYEE';
  const [search, setSearch] = useState('');
  const { rows, page, setPage, totalPages, loading, error, reload } = usePaged<Row>(`/projects?search=${encodeURIComponent(search)}`, search);
  const [msg, setMsg] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div>
      <PageHead title="Projects" sub="Ownership + membership enforced. Progress = DONE / total tasks." />
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="toolbar">
        <input className="input" placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="grid cols-2">
        <div>
          {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : rows.length === 0 ? <Empty text="No projects in scope." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Status</th><th>Owner</th><th>Open</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td><Link to={`/projects/${r._id}`}>{r.name}</Link></td>
                      <td><Badge value={r.status} /></td>
                      <td>{typeof r.ownerId === 'object' ? r.ownerId.name : '—'}</td>
                      <td><Link to={`/tasks?projectId=${r._id}`}>tasks</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
        {canCreate ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>New project</h3>
            <form onSubmit={handleSubmit(async (v) => {
              try { await post('/projects', { ...v, memberIds: [] }); setMsg('Project created.'); reset(); reload(); }
              catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
            })}>
              <div className="field"><label>Name</label><input className="input" {...register('name')} />{formState.errors.name ? <span className="err">{formState.errors.name.message}</span> : null}</div>
              <div className="field"><label>Description</label><textarea className="textarea" {...register('description')} /></div>
              <button className="btn primary" disabled={formState.isSubmitting}>Create</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
