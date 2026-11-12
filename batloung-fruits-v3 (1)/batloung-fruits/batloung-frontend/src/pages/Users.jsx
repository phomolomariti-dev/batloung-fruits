import { useMemo, useState } from 'react';
import useFetch from '../utils/useFetch';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal, Empty, ErrorBox, Loading, PageHeader, SearchBox, Select, StatCard, Table } from '../components/ui';
import { fmtDate } from '../utils/format';

const LABEL = { google: 'Google', github: 'GitHub', apple: 'Apple', facebook: 'Facebook' };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/users');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [pending, setPending] = useState(null); // { u, change, title, message }
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (data || []).filter((u) => (!role || u.role === role) && (!search || `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))), [data, role, search]);
  const count = (f) => (data || []).filter(f).length;

  const apply = async (u, change) => {
    setBusy(true);
    try { await api.put(`/users/${u.id}`, change); toast(`${u.full_name} updated`); reload(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); setPending(null); }
  };
  const changeRole = (u, next) => {
    if (next === 'administrator') setPending({ u, change: { role: next }, title: 'Make this person an administrator?', message: `${u.full_name} will be able to change prices, stock, suppliers, vendors, orders and every user's access.` });
    else apply(u, { role: next });
  };
  const toggleActive = (u) => {
    if (u.is_active) setPending({ u, change: { is_active: false }, title: 'Switch this account off?', message: `${u.full_name} will be signed out straight away and will not be able to sign in until you switch the account back on.` });
    else apply(u, { is_active: true });
  };

  return (
    <>
      <PageHeader title="Users & access" subtitle="Everyone with an account. Change a role or switch an account off; it takes effect on their very next click." />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Administrators" value={count((u) => u.role === 'administrator' && u.is_active)} icon="admin_panel_settings" />
        <StatCard label="Sales" value={count((u) => u.role === 'sales' && u.is_active)} icon="badge" />
        <StatCard label="Switched off" value={count((u) => !u.is_active)} icon="block" tone="warn" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name or email..." />
        <Select value={role} onChange={setRole} label="Filter by role"><option value="">All roles</option><option value="administrator">Administrators</option><option value="sales">Sales</option></Select>
      </div>
      <ErrorBox error={error} />
      <Table>
        <thead><tr><th className="th">Person</th><th className="th">Signed up with</th><th className="th">Role</th><th className="th">Terms accepted</th><th className="th">Account</th></tr></thead>
        <tbody className="divide-y divide-outline-variant/40">
          {loading ? <tr><td colSpan={5}><Loading /></td></tr> : rows.length === 0 ? <tr><td colSpan={5}><Empty>No users match.</Empty></td></tr> : rows.map((u) => {
            const self = u.id === me.id;
            return (
              <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                <td className="td"><div className="font-semibold">{u.full_name}{self && <span className="ml-2 rounded-full bg-primary-fixed px-2 py-0.5 text-xs font-semibold text-primary-container">You</span>}</div><div className="text-xs text-outline">{u.email}</div></td>
                <td className="td text-sm">{['Email', ...u.providers.map((p) => LABEL[p] || p)].join(', ')}</td>
                <td className="td">
                  <select className="input !w-auto !py-1.5" value={u.role} disabled={self || busy} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Role for ${u.full_name}`}>
                    <option value="sales">Sales</option><option value="administrator">Administrator</option>
                  </select>
                </td>
                <td className="td whitespace-nowrap text-sm">{u.terms_accepted_at ? fmtDate(u.terms_accepted_at) : '-'}</td>
                <td className="td">
                  <button type="button" role="switch" aria-checked={!!u.is_active} disabled={self || busy} onClick={() => toggleActive(u)} aria-label={`${u.is_active ? 'Switch off' : 'Switch on'} ${u.full_name}`}
                    className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${u.is_active ? 'bg-primary-container' : 'bg-outline-variant'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${u.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {pending && <ConfirmModal title={pending.title} message={pending.message} confirmLabel="Yes, continue" danger={pending.change.is_active === false} busy={busy} onClose={() => setPending(null)} onConfirm={() => apply(pending.u, pending.change)} />}
    </>
  );
}
