import { useState } from 'react';
import useFetch, { useDebounced } from '../utils/useFetch';
import { api, qs } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Empty, ErrorBox, Field, Icon, Loading, Modal, PageHeader, SearchBox, Select, StatCard, Table, Tabs } from '../components/ui';
import { fmtDate, money, num, today } from '../utils/format';

const HEALTH = { Critical: 'bg-error-container text-on-error-container', 'Reorder Soon': 'bg-tertiary-fixed text-tertiary', 'In Stock': 'bg-primary-fixed text-primary-container', Surplus: 'bg-secondary-container text-on-secondary-container' };
const EMPTY = { supplier_id: '', fruit_id: '', box_size_id: '', quantity: '', cost_per_box: '', batch_no: '', purchase_date: today() };

export default function Stock() {
  const toast = useToast();
  const [tab, setTab] = useState('inventory');
  const [fruitId, setFruitId] = useState('');
  const [boxId, setBoxId] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const fruits = useFetch('/fruits?status=active');
  const boxes = useFetch('/box-sizes');
  const provinces = useFetch('/provinces');
  const suppliers = useFetch('/suppliers');
  const products = useFetch('/products?active=1');
  const inv = useFetch(`/stock${qs({ fruit_id: fruitId, box_size_id: boxId, province_id: provinceId, status, search: q })}`);
  const purchases = useFetch(`/stock/purchases${qs({ fruit_id: fruitId, province_id: provinceId })}`, { skip: tab !== 'purchases' });
  const [form, setForm] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  const rows = inv.data || [];
  const total = rows.reduce((s, r) => s + r.stock_quantity, 0);
  const critical = rows.filter((r) => r.stock_status === 'Critical');
  const product = form && products.data?.find((p) => String(p.fruit_id) === String(form.fruit_id) && String(p.box_size_id) === String(form.box_size_id));
  const cost = Number(form?.quantity || 0) * Number(form?.cost_per_box || 0);

  const save = async () => {
    const e = {};
    if (!form.supplier_id) e.supplier_id = 'Select a registered supplier';
    if (!form.fruit_id) e.fruit_id = 'Select a fruit';
    if (!form.box_size_id) e.box_size_id = 'Select a box size';
    else if (form.fruit_id && !product) e.box_size_id = 'No product exists for this fruit and box size';
    if (!(Number.isInteger(Number(form.quantity)) && Number(form.quantity) > 0)) e.quantity = 'Quantity must be a whole number above zero';
    if (form.cost_per_box === '' || Number(form.cost_per_box) < 0) e.cost_per_box = 'Enter the cost per box';
    if (!form.batch_no.trim()) e.batch_no = 'Batch number is required';
    if (!form.purchase_date) e.purchase_date = 'Purchase date is required';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.post('/stock', { supplier_id: Number(form.supplier_id), product_id: product.id, quantity: Number(form.quantity), cost_per_box: Number(form.cost_per_box), batch_no: form.batch_no, purchase_date: form.purchase_date });
      toast(`Recorded ${form.quantity} boxes. Stock updated.`);
      setForm(null); inv.reload(); purchases.reload(); suppliers.reload(); products.reload();
    } catch (err) { setErrs(err.details && Object.keys(err.details).length ? err.details : { form: err.message }); } finally { setBusy(false); }
  };

  const filters = (
    <div className="mb-4 flex flex-wrap gap-2">
      {tab === 'inventory' && <SearchBox value={search} onChange={setSearch} placeholder="Search fruit or SKU..." />}
      <Select value={fruitId} onChange={setFruitId} label="Filter by fruit"><option value="">All fruits</option>{fruits.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
      {tab === 'inventory' && <Select value={boxId} onChange={setBoxId} label="Filter by box size"><option value="">All box sizes</option>{boxes.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>}
      <Select value={provinceId} onChange={setProvinceId} label="Filter by province"><option value="">All provinces</option>{provinces.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      {tab === 'inventory' && <Select value={status} onChange={setStatus} label="Filter by stock status"><option value="">All statuses</option>{Object.keys(HEALTH).map((s) => <option key={s}>{s}</option>)}</Select>}
    </div>
  );

  return (
    <>
      <PageHeader title="Stock & purchases" subtitle="Record fruit arriving from suppliers and watch live balances per fruit and box size."
        actions={<button className="btn-primary" onClick={() => { setForm(EMPTY); setErrs({}); }}><Icon name="add_box" /> Record incoming stock</button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Boxes in stock" value={num(total)} icon="warehouse" hint="Matching current filters" />
        <StatCard label="Critical lines" value={critical.length} icon="warning" tone="warn" hint={critical.map((c) => `${c.fruit} (${c.box_size})`).join(', ') || 'All lines above threshold'} />
        <StatCard label="Product lines" value={rows.length} icon="category" hint="Fruit + box size" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['inventory', 'Live inventory'], ['purchases', 'Purchase history']]} />
      {filters}
      <ErrorBox error={inv.error || purchases.error} />
      {tab === 'inventory' ? (
        <Table>
          <thead><tr><th className="th">Product</th><th className="th">Box</th><th className="th text-right">In stock</th><th className="th text-right">Threshold</th><th className="th">Status</th><th className="th text-right">Price</th><th className="th">Last consignment</th><th className="th">Key supplier</th></tr></thead>
          <tbody className="divide-y divide-outline-variant/40">
            {inv.loading ? <tr><td colSpan={8}><Loading /></td></tr> : rows.length === 0 ? <tr><td colSpan={8}><Empty>No stock lines match.</Empty></td></tr> : rows.map((r) => (
              <tr key={r.id}>
                <td className="td"><div className="font-semibold">{r.fruit}</div><div className="mono text-xs text-outline">{r.sku}</div></td>
                <td className="td">{r.box_size} <span className="text-xs text-outline">({r.weight_kg}kg)</span></td>
                <td className="td mono text-right font-semibold">{num(r.stock_quantity)}</td>
                <td className="td mono text-right text-outline">{num(r.reorder_threshold)}</td>
                <td className="td"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${HEALTH[r.stock_status]}`}>{r.stock_status}</span></td>
                <td className="td mono text-right">{money(r.selling_price)}</td>
                <td className="td whitespace-nowrap">{r.last_consignment ? <><span className="mono">{r.last_consignment.batch_no}</span><div className="text-xs text-outline">{fmtDate(r.last_consignment.purchase_date)}</div></> : '-'}</td>
                <td className="td">{r.key_supplier || '-'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Table>
          <thead><tr><th className="th">Date</th><th className="th">Batch</th><th className="th">Supplier</th><th className="th">Province</th><th className="th">Product</th><th className="th text-right">Boxes</th><th className="th text-right">Cost / box</th><th className="th text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-outline-variant/40">
            {purchases.loading ? <tr><td colSpan={8}><Loading /></td></tr> : purchases.data?.length === 0 ? <tr><td colSpan={8}><Empty>No purchases recorded.</Empty></td></tr> : purchases.data?.map((p) => (
              <tr key={p.id}>
                <td className="td whitespace-nowrap">{fmtDate(p.purchase_date)}</td><td className="td mono">{p.batch_no}</td><td className="td">{p.supplier_name}</td><td className="td">{p.province}</td>
                <td className="td">{p.fruit} ({p.box_size})</td><td className="td mono text-right">{num(p.quantity)}</td><td className="td mono text-right">{money(p.cost_per_box)}</td><td className="td mono text-right">{money(p.total_cost)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {form && (
        <Modal wide title="Record incoming consignment" onClose={() => setForm(null)} footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}><Icon name="verified" /> Commit to inventory</button></>}>
          <ErrorBox error={errs.form} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier *" error={errs.supplier_id}>
              <select className={`input ${errs.supplier_id ? 'input-error' : ''}`} value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Select registered supplier...</option>{suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.supplier_name} ({s.province})</option>)}
              </select>
            </Field>
            <Field label="Fruit *" error={errs.fruit_id}>
              <select className={`input ${errs.fruit_id ? 'input-error' : ''}`} value={form.fruit_id} onChange={(e) => setForm({ ...form, fruit_id: e.target.value })}>
                <option value="">Select fruit...</option>{fruits.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            <Field label="Box size *" error={errs.box_size_id}>
              <select className={`input ${errs.box_size_id ? 'input-error' : ''}`} value={form.box_size_id} onChange={(e) => setForm({ ...form, box_size_id: e.target.value })}>
                <option value="">Select box size...</option>{boxes.data?.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.weight_kg}kg)</option>)}
              </select>
            </Field>
            <Field label="Boxes received *" error={errs.quantity}><input className={`input ${errs.quantity ? 'input-error' : ''}`} type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
            <Field label="Cost per box (R) *" error={errs.cost_per_box}><input className={`input ${errs.cost_per_box ? 'input-error' : ''}`} type="number" min="0" step="0.01" value={form.cost_per_box} onChange={(e) => setForm({ ...form, cost_per_box: e.target.value })} /></Field>
            <Field label="Batch / consignment no. *" error={errs.batch_no}><input className={`input ${errs.batch_no ? 'input-error' : ''}`} value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} maxLength={40} /></Field>
            <Field label="Purchase date *" error={errs.purchase_date}><input className="input" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container px-4 py-3 text-sm">
            <span>{product ? <>Stock for <b>{product.fruit} ({product.box_size})</b> goes from {num(product.stock_quantity)} to <b>{num(product.stock_quantity + (Number(form.quantity) > 0 ? Number(form.quantity) : 0))}</b> boxes</> : 'Choose a fruit and box size to see the effect on stock'}</span>
            <span className="mono font-semibold">Total cost {money(cost)}</span>
          </div>
        </Modal>
      )}
    </>
  );
}
