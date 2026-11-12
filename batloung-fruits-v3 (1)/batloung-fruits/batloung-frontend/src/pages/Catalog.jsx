import { useState } from 'react';
import useFetch, { useDebounced } from '../utils/useFetch';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal, Empty, ErrorBox, Field, Icon, Loading, Modal, PageHeader, SearchBox, Select, Table, Tabs } from '../components/ui';
import { money, num } from '../utils/format';

function FruitsTab() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search);
  const { data, error, loading, reload } = useFetch(`/fruits${qs({ search: q, status })}`);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  const open = (f) => { setEditing(f || {}); setForm({ name: f?.name || '', description: f?.description || '' }); setErrs({}); };
  const save = async () => {
    if (!form.name.trim()) return setErrs({ name: 'Fruit name is required' });
    setBusy(true);
    try {
      if (editing.id) await api.put(`/fruits/${editing.id}`, form); else await api.post('/fruits', form);
      toast(editing.id ? 'Fruit updated' : 'Fruit added (inactive until you activate it)');
      setEditing(null); reload();
    } catch (e) { setErrs(e.details?.name ? e.details : { name: e.message }); } finally { setBusy(false); }
  };
  const toggle = async (f) => { try { await api.put(`/fruits/${f.id}`, { is_active: f.is_active ? 0 : 1 }); reload(); } catch (e) { toast(e.message, 'error'); } };
  const remove = async () => {
    setBusy(true);
    try { const r = await api.del(`/fruits/${removing.id}`); toast(r.message); setRemoving(null); reload(); }
    catch (e) { toast(e.message, 'error'); setRemoving(null); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search fruits..." />
        <Select value={status} onChange={setStatus} label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
        {isAdmin && <button className="btn-primary" onClick={() => open()}><Icon name="add" /> Add fruit</button>}
      </div>
      <ErrorBox error={error} />
      <Table>
        <thead><tr><th className="th">Fruit</th><th className="th">Description</th><th className="th text-right">Products</th><th className="th text-right">Stock (boxes)</th><th className="th">Status</th>{isAdmin && <th className="th text-right">Actions</th>}</tr></thead>
        <tbody className="divide-y divide-outline-variant/40">
          {loading ? <tr><td colSpan={6}><Loading /></td></tr> : data?.length === 0 ? <tr><td colSpan={6}><Empty>No fruits match your search.</Empty></td></tr> : data?.map((f) => (
            <tr key={f.id}>
              <td className="td font-semibold">{f.name}</td>
              <td className="td text-on-surface-variant">{f.description || '-'}</td>
              <td className="td mono text-right">{f.product_count}</td>
              <td className="td mono text-right">{num(f.total_stock)}</td>
              <td className="td"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${f.is_active ? 'bg-primary-fixed text-primary-container' : 'bg-surface-container-high text-outline'}`}>{f.is_active ? 'Active' : 'Inactive'}</span></td>
              {isAdmin && <td className="td whitespace-nowrap text-right">
                <button className="btn-ghost !p-1.5 text-lg" onClick={() => open(f)} aria-label={`Edit ${f.name}`}><Icon name="edit" /></button>
                <button className="btn-ghost !p-1.5 text-lg" onClick={() => toggle(f)} aria-label={f.is_active ? `Deactivate ${f.name}` : `Activate ${f.name}`} title={f.is_active ? 'Deactivate' : 'Activate'}><Icon name={f.is_active ? 'toggle_on' : 'toggle_off'} /></button>
                <button className="btn-ghost !p-1.5 text-lg text-error" onClick={() => setRemoving(f)} aria-label={`Delete ${f.name}`}><Icon name="delete" /></button>
              </td>}
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && (
        <Modal title={editing.id ? 'Edit fruit' : 'Add fruit'} onClose={() => setEditing(null)} footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
          <div className="space-y-4">
            <Field label="Fruit name *" error={errs.name}><input className={`input ${errs.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} /></Field>
            <Field label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={255} /></Field>
            {!editing.id && <p className="text-xs text-outline">The five specified fruits are pre-loaded. Any extra fruit starts inactive and is not sold until an administrator activates it.</p>}
          </div>
        </Modal>
      )}
      {removing && <ConfirmModal danger title="Remove fruit" confirmLabel="Remove" busy={busy} onClose={() => setRemoving(null)} onConfirm={remove}
        message={`Remove ${removing.name}? Fruits that already have products are deactivated instead of deleted, and fruits on open orders cannot be removed.`} />}
    </>
  );
}

function BoxSizesTab() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/box-sizes');
  const [edit, setEdit] = useState({});
  if (loading) return <Loading />;
  const save = async (b) => {
    try { await api.put(`/box-sizes/${b.id}`, { weight_kg: edit[b.id] }); toast(`${b.name} box updated`); setEdit((s) => ({ ...s, [b.id]: undefined })); reload(); }
    catch (e) { toast(e.details?.weight_kg || e.message, 'error'); }
  };
  return (
    <>
      <ErrorBox error={error} />
      <p className="mb-4 max-w-2xl text-sm text-on-surface-variant">Fruit and box size together form a separate saleable product, so Apples (Small), Apples (Medium) and Apples (Large) each have their own price and stock.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {data?.map((b) => (
          <div key={b.id} className="card p-5">
            <div className="text-lg font-semibold text-primary">{b.name}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight">{b.weight_kg} <span className="text-base font-medium text-outline">kg</span></div>
            {isAdmin && (
              <div className="mt-4 flex gap-2">
                <input className="input" type="number" min="0.1" step="0.1" value={edit[b.id] ?? ''} placeholder="New weight" onChange={(e) => setEdit({ ...edit, [b.id]: e.target.value })} aria-label={`New weight for ${b.name} box`} />
                <button className="btn-secondary" disabled={!edit[b.id]} onClick={() => save(b)}>Update</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function ProductsTab() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [fruitId, setFruitId] = useState('');
  const [boxId, setBoxId] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const fruits = useFetch('/fruits');
  const boxes = useFetch('/box-sizes');
  const { data, error, loading, reload } = useFetch(`/products${qs({ fruit_id: fruitId, box_size_id: boxId, search: q })}`);
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);
  const [errs, setErrs] = useState({});

  const savePrice = async () => {
    try { await api.put(`/products/${edit.id}`, { selling_price: edit.selling_price, reorder_threshold: edit.reorder_threshold }); toast('Product updated'); setEdit(null); reload(); }
    catch (e) { setErrs(e.details || { selling_price: e.message }); }
  };
  const create = async () => {
    const er = {};
    if (!add.fruit_id) er.fruit_id = 'Select a fruit';
    if (!add.box_size_id) er.box_size_id = 'Every product must have a box size';
    if (!(Number(add.selling_price) > 0)) er.selling_price = 'Every product must have a selling price greater than zero';
    setErrs(er);
    if (Object.keys(er).length) return;
    try { await api.post('/products', add); toast('Product created'); setAdd(null); reload(); } catch (e) { setErrs(e.details && Object.keys(e.details).length ? e.details : { form: e.message }); }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search products or SKU..." />
        <Select value={fruitId} onChange={setFruitId} label="Filter by fruit"><option value="">All fruits</option>{fruits.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
        <Select value={boxId} onChange={setBoxId} label="Filter by box size"><option value="">All box sizes</option>{boxes.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        {isAdmin && <button className="btn-primary" onClick={() => { setAdd({ fruit_id: '', box_size_id: '', selling_price: '' }); setErrs({}); }}><Icon name="add" /> Add product</button>}
      </div>
      <ErrorBox error={error} />
      <Table>
        <thead><tr><th className="th">SKU</th><th className="th">Fruit</th><th className="th">Box size</th><th className="th text-right">Selling price</th><th className="th text-right">In stock</th><th className="th text-right">Reorder at</th>{isAdmin && <th className="th text-right">Actions</th>}</tr></thead>
        <tbody className="divide-y divide-outline-variant/40">
          {loading ? <tr><td colSpan={7}><Loading /></td></tr> : data?.length === 0 ? <tr><td colSpan={7}><Empty>No products found.</Empty></td></tr> : data?.map((p) => (
            <tr key={p.id} className={p.is_active ? '' : 'opacity-50'}>
              <td className="td mono">{p.sku}</td>
              <td className="td font-semibold">{p.fruit}</td>
              <td className="td">{p.box_size} <span className="text-xs text-outline">({p.weight_kg}kg)</span></td>
              <td className="td mono text-right">{money(p.selling_price)}</td>
              <td className="td mono text-right">{num(p.stock_quantity)}</td>
              <td className="td mono text-right">{num(p.reorder_threshold)}</td>
              {isAdmin && <td className="td text-right"><button className="btn-ghost !p-1.5 text-lg" onClick={() => { setEdit({ ...p }); setErrs({}); }} aria-label={`Edit ${p.fruit} ${p.box_size}`}><Icon name="edit" /></button></td>}
            </tr>
          ))}
        </tbody>
      </Table>
      {edit && (
        <Modal title={`${edit.fruit} (${edit.box_size})`} onClose={() => setEdit(null)} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={savePrice}>Save</button></>}>
          <div className="space-y-4">
            <Field label="Selling price per box (R) *" error={errs.selling_price}><input className={`input ${errs.selling_price ? 'input-error' : ''}`} type="number" min="0.01" step="0.01" value={edit.selling_price} onChange={(e) => setEdit({ ...edit, selling_price: e.target.value })} /></Field>
            <Field label="Reorder threshold (boxes)" error={errs.reorder_threshold}><input className="input" type="number" min="0" value={edit.reorder_threshold} onChange={(e) => setEdit({ ...edit, reorder_threshold: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {add && (
        <Modal title="Add product" onClose={() => setAdd(null)} footer={<><button className="btn-secondary" onClick={() => setAdd(null)}>Cancel</button><button className="btn-primary" onClick={create}>Create product</button></>}>
          <div className="space-y-4">
            <ErrorBox error={errs.form} />
            <Field label="Fruit *" error={errs.fruit_id}><select className={`input ${errs.fruit_id ? 'input-error' : ''}`} value={add.fruit_id} onChange={(e) => setAdd({ ...add, fruit_id: e.target.value })}><option value="">Select fruit...</option>{fruits.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
            <Field label="Box size *" error={errs.box_size_id}><select className={`input ${errs.box_size_id ? 'input-error' : ''}`} value={add.box_size_id} onChange={(e) => setAdd({ ...add, box_size_id: e.target.value })}><option value="">Select box size...</option>{boxes.data?.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.weight_kg}kg)</option>)}</select></Field>
            <Field label="Selling price per box (R) *" error={errs.selling_price}><input className={`input ${errs.selling_price ? 'input-error' : ''}`} type="number" min="0.01" step="0.01" value={add.selling_price} onChange={(e) => setAdd({ ...add, selling_price: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Catalog() {
  const [tab, setTab] = useState('fruits');
  return (
    <>
      <PageHeader title="Fruits & box sizes" subtitle="The five core fruits, three box sizes, and the product (fruit + box size) each price and stock level belongs to." />
      <Tabs value={tab} onChange={setTab} tabs={[['fruits', 'Fruits'], ['boxes', 'Box sizes'], ['products', 'Products']]} />
      {tab === 'fruits' && <FruitsTab />}
      {tab === 'boxes' && <BoxSizesTab />}
      {tab === 'products' && <ProductsTab />}
    </>
  );
}
