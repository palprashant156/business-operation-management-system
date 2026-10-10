import { useState } from 'react';
import { usePaged } from '../hooks/usePaged';
import { PageHead, Badge, Empty, Loading, Pager } from '../components/ui';

interface Row { _id: string; employeeCode: string; department: string; jobTitle: string; status: string; userId: { name: string; email: string; role: string } | string; }

export function Employees(): JSX.Element {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const path = `/employees?search=${encodeURIComponent(search)}${department ? `&department=${encodeURIComponent(department)}` : ''}`;
  const { rows, page, setPage, totalPages, loading, error } = usePaged<Row>(path, `${search}|${department}`);

  return (
    <div>
      <PageHead title="Employees" sub="Managers see only direct reports. Admins see everyone." />
      <div className="toolbar">
        <input className="input" placeholder="Search code, dept, title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input" placeholder="Filter department…" value={department} onChange={(e) => setDepartment(e.target.value)} />
      </div>
      {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : rows.length === 0 ? <Empty text="No employees in scope." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Title</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{r.employeeCode}</td>
                  <td>{typeof r.userId === 'object' ? `${r.userId.name} (${r.userId.email})` : String(r.userId)}</td>
                  <td>{r.department}</td><td>{r.jobTitle}</td>
                  <td><Badge value={r.status} /></td>
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
