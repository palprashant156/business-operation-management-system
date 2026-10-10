import { useEffect, useMemo, useState } from 'react';
import { getEnvelope, patch } from '../services/api';
import { usePaged } from '../hooks/usePaged';
import { useAuth } from '../features/auth/AuthContext';
import { Avatar, Badge, Drawer, Empty, KpiCard, Loading, Pager, PageHead } from '../components/ui';

interface Row {
  _id: string;
  employeeCode: string;
  department: string;
  jobTitle: string;
  status: string;
  joiningDate?: string;
  managerId?: string | null;
  userId: { _id?: string; name: string; email: string; role: string } | string;
}

function userOf(r: Row): { name: string; email: string; role: string; id: string } {
  if (typeof r.userId === 'string') return { name: r.userId, email: '', role: '', id: '' };
  const u = r.userId as { _id?: string; name: string; email: string; role: string };
  return { name: u.name, email: u.email, role: u.role, id: u._id ?? '' };
}

const DEPARTMENTS = ['All', 'Operations', 'Engineering', 'Product', 'Support'];

export function Employees(): JSX.Element {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState<'name' | 'code'>('name');
  const [kpis, setKpis] = useState<{ total: number; active: number; leave: number; depts: number } | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  const query = `/employees?search=${encodeURIComponent(search)}${department !== 'All' ? `&department=${encodeURIComponent(department)}` : ''}${status !== 'All' ? `&status=${status}` : ''}`;
  const { rows, page, setPage, totalPages, total, loading, error, reload } = usePaged<Row>(query, `${search}|${department}|${status}`);

  // KPI strip from a bounded sample (limit 100) — counts labeled as scoped sample.
  useEffect(() => {
    let alive = true;
    void getEnvelope<Row[]>('/employees?limit=100')
      .then((env) => {
        if (!alive) return;
        const all = env.data;
        setKpis({
          total: env.pagination?.total ?? all.length,
          active: all.filter((r) => r.status === 'ACTIVE').length,
          leave: all.filter((r) => r.status === 'ON_LEAVE').length,
          depts: new Set(all.map((r) => r.department)).size,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) =>
      sort === 'name'
        ? userOf(a).name.localeCompare(userOf(b).name)
        : a.employeeCode.localeCompare(b.employeeCode),
    );
    return copy;
  }, [rows, sort]);

  const activeFilters: string[] = [];
  if (department !== 'All') activeFilters.push(`Dept: ${department}`);
  if (status !== 'All') activeFilters.push(`Status: ${status}`);

  return (
    <div>
      <PageHead
        eyebrow={`Workforce directory / ${total} headcount`}
        title="Employees"
        sub="Manage employee information, organizational reporting, and role-based permissions."
        actions={
          <>
            <button className="btn">⭳ Export CSV</button>
            {isAdmin ? <button className="btn primary">⛉ + Add employee</button> : null}
          </>
        }
      />

      <div className="grid cols-4">
        <KpiCard label="Total active" value={kpis?.active ?? '—'} sub="in scope" icon="⛉" />
        <KpiCard label="Onboarding" value={kpis ? total - kpis.active : '—'} sub="outside active state" icon="⏳" />
        <KpiCard label="On leave" value={kpis?.leave ?? '—'} sub="returns tracked" icon="◍" />
        <KpiCard label="Dept occupancy" value={kpis ? `${kpis.depts} depts` : '—'} sub="optimal" icon="◐" />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Search by employee name, email, or ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search employees" />
          <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department filter" style={{ maxWidth: 170 }}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d === 'All' ? 'All departments' : d}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter" style={{ maxWidth: 150 }}>
            {['All', 'ACTIVE', 'INACTIVE', 'ON_LEAVE'].map((s) => <option key={s} value={s}>{s === 'All' ? 'Status: All' : s}</option>)}
          </select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'code')} aria-label="Sort" style={{ maxWidth: 160 }}>
            <option value="name">Sort: Name A-Z</option>
            <option value="code">Sort: Code</option>
          </select>
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          Active filters: {activeFilters.length === 0 ? 'none' : activeFilters.join(' · ')}
          <button className="icon-btn" style={{ fontSize: 12.5 }} onClick={() => { setSearch(''); setDepartment('All'); setStatus('All'); }}>⟳ Reset filters</button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {loading ? <Loading /> : error ? <div className="form-error">{error}</div> : sorted.length === 0 ? <Empty text="No employees match these filters." /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Employee</th><th>Employee ID</th><th>Department</th><th>Job title</th><th>Status</th></tr></thead>
              <tbody>
                {sorted.map((r) => {
                  const u = userOf(r);
                  return (
                    <tr key={r._id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }} className={selected?._id === r._id ? 'selected' : ''}>
                      <td>
                        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <Avatar name={u.name} />
                          <span><b>{u.name}</b> {u.role ? <Badge value={u.role} /> : null}<br /><span className="muted">{u.email}</span></span>
                        </span>
                      </td>
                      <td className="mono">{r.employeeCode}</td>
                      <td><span className="badge TODO">{r.department}</span></td>
                      <td>{r.jobTitle}</td>
                      <td><Badge value={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Showing {sorted.length} of {total} employees</div>
        <Pager page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {selected ? (
        <EditEmployeeDrawer
          row={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setSelected(updated);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function EditEmployeeDrawer({
  row,
  isAdmin,
  onClose,
  onSaved,
}: {
  row: Row;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (r: Row) => void;
}): JSX.Element {
  const u = userOf(row);
  const [tab, setTab] = useState<'profile' | 'perms' | 'team'>('profile');
  const [department, setDepartment] = useState(row.department);
  const [jobTitle, setJobTitle] = useState(row.jobTitle);
  const [status, setStatus] = useState(row.status);
  const [managerId, setManagerId] = useState(typeof row.managerId === 'string' ? row.managerId : '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState(u.role);

  async function save(): Promise<void> {
    setSaving(true);
    setMsg(null);
    try {
      // Backend allowlists per role: non-admins may only send department/jobTitle.
      const body: Record<string, string> = { department, jobTitle };
      if (isAdmin) {
        body.status = status;
        if (managerId.trim()) body.managerId = managerId.trim();
      }
      const updated = await patch<Row>(`/employees/${row._id}`, body);
      setMsg({ ok: true, text: 'Employee updated.' });
      onSaved(updated);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Update failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveRole(): Promise<void> {
    if (!u.id) {
      setMsg({ ok: false, text: 'Linked user id unavailable.' });
      return;
    }
    setSaving(true);
    try {
      await patch(`/users/${u.id}/role`, { role: newRole });
      setMsg({ ok: true, text: `Role updated to ${newRole}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Role change rejected.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Edit Employee"
      sub={`${u.name} — ${row.jobTitle}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving} onClick={() => void save()}>✓ Save changes</button>
        </>
      }
    >
      <div className="muted mono">{row.employeeCode} • <Badge value={row.status} /></div>
      <div className="tabs">
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>Profile</button>
        <button className={tab === 'perms' ? 'on' : ''} onClick={() => setTab('perms')}>Permissions &amp; Role</button>
        <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>Team Assign</button>
      </div>
      {msg ? <div className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</div> : null}

      {tab === 'profile' ? (
        <>
          <div className="field"><label>Full Name</label><input className="input" value={u.name} disabled title="Names change via Users (admin)" /></div>
          <div className="field"><label>Work Email</label><input className="input" value={u.email} disabled /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Department</label>
              <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {DEPARTMENTS.filter((d) => d !== 'All').map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status {isAdmin ? '' : '(admin only)'}</label>
              <select className="select" value={status} disabled={!isAdmin} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ON_LEAVE">On leave</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Job Title</label><input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
          <div className="field">
            <label>Direct Manager (user id) {isAdmin ? '' : '(admin only)'}</label>
            <input className="input" value={managerId} disabled={!isAdmin} onChange={(e) => setManagerId(e.target.value)} placeholder="24-hex user id" />
          </div>
        </>
      ) : null}

      {tab === 'perms' ? (
        <>
          <div className="comment-box">
            <b>Current role: {u.role || '—'}</b>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Roles are enforced by the backend on every request. Changing a role never affects your own session.
            </div>
          </div>
          {isAdmin && u.id ? (
            <div className="field">
              <label>Assign role</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                </select>
                <button className="btn" disabled={saving} onClick={() => void saveRole()}>Apply</button>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>Only admins can change roles.</div>
          )}
        </>
      ) : null}

      {tab === 'team' ? (
        <div className="comment-box">
          <b>Project membership</b>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Add this employee to projects from the Projects page (owner or admin). Membership changes trigger a notification to the member.
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
