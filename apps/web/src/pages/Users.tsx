import { useState } from 'react';
import { get, patch } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { PageHead, Badge, Empty, Loading, Pager } from '../components/ui';

interface Row { id: string; name: string; email: string; role: string; status: string; }

export function Users(): JSX.Element {
  const [search, setSearch] = useState('');
  const { rows, page, setPage, totalPages, loading, error, reload } = usePaged<Row>(
    `/users?search=${encodeURIComponent(search)}`,
    search,
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function changeRole(id: string, role: string): Promise<void> {
    setMsg(null);
    try {
      await patch(`/users/${id}/role`, { role });
      setMsg(`Role updated to ${role}.`);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Update failed.');
    }
  }

  return (
    <div>
      <PageHead title="Users" sub="Admin only. Role changes are audited via backend policy (no self-promotion)." />
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="toolbar">
        <input className="input" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn" onClick={() => void get('/auth/me').then(() => reload())}>Refresh</button>
      </div>
      {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : rows.length === 0 ? <Empty text="No users found." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.email}</td>
                  <td><Badge value={u.role} /></td><td><Badge value={u.status} /></td>
                  <td>
                    <select className="select" defaultValue={u.role} onChange={(e) => void changeRole(u.id, e.target.value)} aria-label={`Change role for ${u.email}`}>
                      <option value="ADMIN">ADMIN</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="EMPLOYEE">EMPLOYEE</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}
