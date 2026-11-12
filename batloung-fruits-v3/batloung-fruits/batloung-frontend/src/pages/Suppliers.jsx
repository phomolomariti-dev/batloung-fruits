import { useMemo, useState } from 'react';
import useFetch, { useDebounced } from '../utils/useFetch';
import { api, qs } from '../api/client';
import { useToast } from '../context/ToastContext';
import { ConfirmModal, Empty, ErrorBox, Field, Icon, Loading, Modal, PageHeader, SearchBox, Table } from '../components/ui';

const EMPTY = { supplier_name: '', province_id: '', contact_person: '', telephone: '', email: '', physical_address: '', fruit_ids: [] };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9 ()-]{7,20}$/;

function validate(f) {
  const e = {};
  if (!f.supplier_name.trim()) e.supplier_name = 'Supplier name is required';
  if (!f.province_id) e.province_id = 'Select a South African province';
  if (!f.contact_person.trim()) e.contact_person = 'Contact person is required';
  if (!PHONE_RE.test(f.telephone)) e.telephone = 'Enter a valid telephone number';
  if (!EMAIL_RE.test(f.email)) e.email = 'Enter a valid email address';
  if (!f.physical_address.trim()) e.physical_address = 'Physical address is required';
  return e;
}

export default function Suppliers() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('');
  const q = useDebounced(search);
  const provinces = useFetch('/provinces');
  const fruits = useFetch('/fruits?status=active');
  const all = useFetch('/suppliers'); // unfiltered, for per-province counts
  const { data, error, loading, reload } = useFetch(`/suppliers${qs({ search: q, province_id: province })}`);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c = {};
    all.data?.forEach((s) => { c[s.province_id] = (c[s.province_id] || 0) + 1; });
    return c;
  }, [all.data]);

  const refresh = () => { reload(); all.reload(); };
  const open = async (s) => {
    setErrs({});
    if (!s) { setForm(EMPTY); setEditing({}); return; }
    const full = await api.get(`/suppliers/${s.id}`);
    setForm({ ...EMPTY, ...full, fruit_ids: full.fruit_ids });
    setEditing(s);
  };
  const toggleFruit = (id) => setForm((f) => ({ ...f, fruit_ids: f.fruit_ids.includes(id) ? f.fruit_ids.filter((x) => x !== id) : [...f.fruit_ids, id] }));

  const save = async () => {
    const e = validate(form);
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body = { ...form, province_id: Number(form.province_id) };
      if (editing.id) await api.put(`/suppliers/${editing.id}`, body); else await api.post('/suppliers', body);
      toast(editing.id ? 'Supplier updated' : 'Supplier added');
      setEditing(null); refresh();
    } catch (err) { setErrs(err.details && Object.keys(err.details).length ? err.details : { form: err.message }); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.del(`/suppliers/${removing.id}`); toast('Supplier deleted'); refresh(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); setRemoving(null); }
  };
  const input = (key, label, props = {}) => (
    <Field label={`${label} *`} error={errs[key]}>
      <input className={`input ${errs[key] ? 'input-error' : ''}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </Field>
  );

  return (
    <>
      <PageHeader title="Suppliers & SA provinces" subtitle="Farms and packhouses supplying fruit to the Maseru depot, grouped by the South African province they operate in."
        actions={<button className="btn-primary" onClick={() => open()}><Icon name="add_circle" /> Add supplier</button>} />

      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by province">
        <button onClick={() => setProvince('')} className={`rounded-full border px-3 py-1 text-sm font-medium ${province === '' ? 'border-primary-container bg-primary-container text-on-primary' : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'}`}>All provinces <span className="mono ml-1 opacity-80">{all.data?.length ?? 0}</span></button>
        {provinces.data?.map((p) => (
          <button key={p.id} onClick={() => setProvince(String(p.id))} className={`rounded-full border px-3 py-1 text-sm font-medium ${province === String(p.id) ? 'border-primary-container bg-primary-container text-on-primary' : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'}`}>{p.name} <span className="mono ml-1 opacity-80">{counts[p.id] || 0}</span></button>
        ))}
      </div>
      <div className="mb-4"><SearchBox value={search} onChange={setSearch} placeholder="Search by supplier, contact, email or province..." /></div>
      <ErrorBox error={error} />
      <Table>
        <thead><tr><th className="th">Supplier</th><th className="th">Province</th><th className="th">Contact</th><th className="th">Telephone</th><th className="th">Email</th><th className="th">Fruits supplied</th><th className="th text-right">Consignments</th><th className="th text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-outline-variant/40">
          {loading ? <tr><td colSpan={8}><Loading /></td></tr> : data?.length === 0 ? <tr><td colSpan={8}><Empty>No suppliers match.</Empty></td></tr> : data?.map((s) => (
            <tr key={s.id}>
              <td className="td"><div className="font-semibold">{s.supplier_name}</div><div className="max-w-[220px] truncate text-xs text-outline">{s.physical_address}</div></td>
              <td className="td whitespace-nowrap">{s.province}</td>
              <td className="td">{s.contact_person}</td>
              <td className="td mono whitespace-nowrap">{s.telephone}</td>
              <td className="td">{s.email}</td>
              <td className="td">{s.fruits_supplied || <span className="text-outline">-</span>}</td>
              <td className="td mono text-right">{s.consignments}</td>
              <td className="td whitespace-nowrap text-right">
                <button className="btn-ghost !p-1.5 text-lg" onClick={() => open(s)} aria-label={`Edit ${s.supplier_name}`}><Icon name="edit" /></button>
                <button className="btn-ghost !p-1.5 text-lg text-error" onClick={() => setRemoving(s)} aria-label={`Delete ${s.supplier_name}`}><Icon name="delete" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {editing && (
        <Modal wide title={editing.id ? 'Edit supplier' : 'Add supplier'} onClose={() => setEditing(null)} footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>Save supplier</button></>}>
          <ErrorBox error={errs.form} />
          <div className="grid gap-4 sm:grid-cols-2">
            {input('supplier_name', 'Supplier name', { maxLength: 120 })}
            <Field label="Province *" error={errs.province_id}>
              <select className={`input ${errs.province_id ? 'input-error' : ''}`} value={form.province_id} onChange={(e) => setForm({ ...form, province_id: e.target.value })}>
                <option value="">Select province...</option>{provinces.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            {input('contact_person', 'Contact person', { maxLength: 100 })}
            {input('telephone', 'Telephone', { placeholder: '+27 ...' })}
            {input('email', 'Email', { type: 'email' })}
            {input('physical_address', 'Physical address', { maxLength: 255 })}
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium">Fruits supplied</legend>
            <div className="flex flex-wrap gap-2">
              {fruits.data?.map((f) => (
                <label key={f.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${form.fruit_ids.includes(f.id) ? 'border-primary-container bg-primary-fixed' : 'border-outline-variant'}`}>
                  <input type="checkbox" checked={form.fruit_ids.includes(f.id)} onChange={() => toggleFruit(f.id)} /> {f.name}
                </label>
              ))}
            </div>
          </fieldset>
        </Modal>
      )}
      {removing && <ConfirmModal danger title="Delete supplier" confirmLabel="Delete" busy={busy} onClose={() => setRemoving(null)} onConfirm={remove} message={`Delete ${removing.supplier_name}? Suppliers with recorded purchases cannot be deleted.`} />}
    </>
  );
}
