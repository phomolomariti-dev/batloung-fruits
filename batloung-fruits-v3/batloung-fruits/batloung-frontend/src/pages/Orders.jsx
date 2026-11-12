import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useFetch, { useDebounced } from '../utils/useFetch';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal, Empty, ErrorBox, Field, Icon, Loading, Modal, PageHeader, SearchBox, Select, StatusBadge, Table } from '../components/ui';
import { STATUSES, fmtDate, money, num, orderRef, today } from '../utils/format';

const SALES_ALLOWED = ['Confirmed', 'Processing', 'Ready for Collection/Delivery', 'Cancelled'];
const blankItem = () => ({ key: Math.random(), fruit_id: '', box_size_id: '', quantity: '' });
const HUB = { lat: -29.3167, lon: 27.4833 };

function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours} hr${remaining ? ` ${remaining} min` : ''}`;
}

function NewOrder({ onClose, onCreated }) {
  const toast = useToast();
  const vendors = useFetch('/vendors?status=Active');
  const products = useFetch('/products?active=1');
  const fruits = useFetch('/fruits?status=active');
  const boxes = useFetch('/box-sizes');
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(today());
  const [items, setItems] = useState([blankItem()]);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState({ state: 'idle' });

  const vendorArea = vendors.data?.find((v) => String(v.id) === vendorId)?.location_area;
  const find = (it) => products.data?.find((p) => String(p.fruit_id) === String(it.fruit_id) && String(p.box_size_id) === String(it.box_size_id));
  const lines = items.map((it) => ({ ...it, product: find(it), qty: Number(it.quantity) }));
  const total = lines.reduce((s, l) => s + (l.product && l.qty > 0 ? l.qty * l.product.selling_price : 0), 0);
  const patch = (key, p) => setItems((arr) => arr.map((x) => (x.key === key ? { ...x, ...p } : x)));

  useEffect(() => {
    if (!vendorId || !vendorArea) {
      setRoute({ state: 'idle' });
      return undefined;
    }

    const controller = new AbortController();
    setRoute({ state: 'loading' });
    const timer = setTimeout(async () => {
      try {
        const search = new URLSearchParams({ q: `${vendorArea}, Maseru, Lesotho`, countrycodes: 'ls', format: 'jsonv2', limit: '1' });
        const geocoding = await fetch(`https://nominatim.openstreetmap.org/search?${search}`, { signal: controller.signal });
        if (!geocoding.ok) throw new Error('Location lookup failed');
        const places = await geocoding.json();
        if (!places.length) throw new Error('Vendor area could not be located');

        const destination = { lat: Number(places[0].lat), lon: Number(places[0].lon) };
        const routing = await fetch(`https://router.project-osrm.org/route/v1/driving/${HUB.lon},${HUB.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`, { signal: controller.signal });
        if (!routing.ok) throw new Error('Route lookup failed');
        const result = await routing.json();
        if (result.code !== 'Ok' || !result.routes?.length) throw new Error('No driving route found');
        setRoute({ state: 'ready', destination, geometry: result.routes[0].geometry.coordinates, distance: result.routes[0].distance, duration: result.routes[0].duration });
      } catch (error) {
        if (error.name !== 'AbortError') setRoute({ state: 'error' });
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [vendorId, vendorArea]);

  const directionsUrl = route.state === 'ready'
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${HUB.lat},${HUB.lon};${route.destination.lat},${route.destination.lon}`
    : '';

  const validate = () => {
    const e = {};
    if (!vendorId) e.vendor = 'An order must belong to a registered street vendor';
    if (items.length === 0) e.items = 'An order must contain at least one item';
    const used = {};
    lines.forEach((l) => {
      if (!l.fruit_id || !l.box_size_id) e[l.key] = 'Select a fruit and a box size';
      else if (!l.product) e[l.key] = 'This fruit and box size combination is not available';
      else if (!Number.isInteger(l.qty) || l.qty <= 0) e[l.key] = 'Quantity must be greater than zero';
      else {
        used[l.product.id] = (used[l.product.id] || 0) + l.qty;
        if (used[l.product.id] > l.product.stock_quantity) e[l.key] = `Only ${l.product.stock_quantity} boxes available`;
      }
    });
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const o = await api.post('/orders', { vendor_id: Number(vendorId), order_date: date, items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })) });
      toast(`${orderRef(o.id)} created for ${money(o.total_amount)}`);
      onCreated();
    } catch (e) { setErrs({ form: e.message }); } finally { setBusy(false); }
  };

  return (
    <Modal wide title="New order" onClose={onClose} footer={<>
      <div className="mr-auto self-center text-sm">Order total <span className="mono text-lg font-bold text-primary">{money(total)}</span></div>
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={submit} disabled={busy}>Place order</button>
    </>}>
      <ErrorBox error={errs.form} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street vendor *" error={errs.vendor}>
          <select className={`input ${errs.vendor ? 'input-error' : ''}`} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select registered vendor...</option>
            {vendors.data?.map((v) => <option key={v.id} value={v.id}>{v.vendor_name} - {v.business_name}</option>)}
          </select>
        </Field>
        <Field label="Order date *"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>

      {vendorId && <section className="mt-5 overflow-hidden rounded-lg border border-outline-variant/60" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 px-4 py-3">
          <div>
            <h3 className="font-semibold">Delivery route estimate</h3>
            <p className="text-xs text-on-surface-variant">Maseru Hub Depot to {vendorArea || 'selected vendor'}</p>
          </div>
          {route.state === 'loading' && <span className="text-sm text-outline">Calculating route...</span>}
          {route.state === 'ready' && <div className="flex gap-4 text-sm">
            <span><b className="mono">{formatDistance(route.distance)}</b> distance</span>
            <span><b className="mono">{formatDuration(route.duration)}</b> driving time</span>
          </div>}
          {route.state === 'error' && <span className="text-sm text-error">Route estimate unavailable for this area.</span>}
        </div>
        {route.state === 'ready' && <>
          <MapContainer key={`${route.destination.lat},${route.destination.lon}`} bounds={[[HUB.lat, HUB.lon], [route.destination.lat, route.destination.lon]]} boundsOptions={{ padding: [24, 24] }} scrollWheelZoom={false} className="h-52 w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline positions={route.geometry.map(([longitude, latitude]) => [latitude, longitude])} pathOptions={{ color: '#28734d', weight: 5 }} />
            <CircleMarker center={[HUB.lat, HUB.lon]} radius={7} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#28734d', fillOpacity: 1 }} />
            <CircleMarker center={[route.destination.lat, route.destination.lon]} radius={7} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#d77a4b', fillOpacity: 1 }} />
          </MapContainer>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-on-surface-variant">
            <span>Approximate from Maseru city centre to vendor area; no live traffic data.</span>
            <a className="font-semibold text-primary-container underline" href={directionsUrl} target="_blank" rel="noreferrer">Open driving route</a>
          </div>
        </>}
      </section>}

      <div className="mt-5 flex items-center justify-between"><h3 className="font-semibold">Items</h3><button className="btn-secondary !py-1" onClick={() => setItems([...items, blankItem()])}><Icon name="add" /> Add item</button></div>
      {errs.items && <p className="mt-1 text-xs font-medium text-error">{errs.items}</p>}
      <div className="mt-2 space-y-3">
        {lines.map((l) => (
          <div key={l.key} className={`rounded-lg border p-3 ${errs[l.key] ? 'border-error' : 'border-outline-variant/60'}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_90px_auto]">
              <select className="input" aria-label="Fruit" value={l.fruit_id} onChange={(e) => patch(l.key, { fruit_id: e.target.value })}><option value="">Fruit...</option>{fruits.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <select className="input" aria-label="Box size" value={l.box_size_id} onChange={(e) => patch(l.key, { box_size_id: e.target.value })}><option value="">Box size...</option>{boxes.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <input className="input" aria-label="Quantity of boxes" type="number" min="1" step="1" placeholder="Qty" value={l.quantity} onChange={(e) => patch(l.key, { quantity: e.target.value })} />
              <button className="btn-ghost text-error" onClick={() => setItems(items.filter((x) => x.key !== l.key))} aria-label="Remove item"><Icon name="delete" /></button>
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-on-surface-variant">
              <span>{l.product ? <>Unit price <b className="mono">{money(l.product.selling_price)}</b> - available <b className="mono">{num(l.product.stock_quantity)}</b> boxes</> : 'Pick a fruit and box size to see price and stock'}</span>
              <span>Subtotal <b className="mono text-on-surface">{money(l.product && l.qty > 0 ? l.qty * l.product.selling_price : 0)}</b></span>
            </div>
            {errs[l.key] && <p className="mt-1 text-xs font-medium text-error">{errs[l.key]}</p>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function OrderDetail({ id, onClose, onChanged }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data: o, error, loading, reload } = useFetch(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [removing, setRemoving] = useState(false);

  const options = useMemo(() => {
    if (!o || ['Completed', 'Cancelled'].includes(o.status)) return [];
    const idx = STATUSES.indexOf(o.status);
    return STATUSES.filter((s, i) => (s === 'Cancelled' || i > idx) && (isAdmin || SALES_ALLOWED.includes(s)));
  }, [o, isAdmin]);

  const change = async (status) => {
    setBusy(true);
    try { await api.put(`/orders/${id}`, { status }); toast(`Order ${status === 'Completed' ? 'completed - stock updated' : `marked ${status}`}`); setConfirm(null); reload(); onChanged(); }
    catch (e) { toast(e.message, 'error'); setConfirm(null); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.del(`/orders/${id}`); toast('Order deleted'); onChanged(); onClose(); } catch (e) { toast(e.message, 'error'); setRemoving(false); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={o ? `${orderRef(o.id)}` : 'Order'} onClose={onClose}
      footer={o && <>
        {isAdmin && o.status !== 'Completed' && <button className="btn-ghost mr-auto text-error" onClick={() => setRemoving(true)}><Icon name="delete" /> Delete</button>}
        {options.map((s) => (
          <button key={s} className={s === 'Cancelled' ? 'btn-secondary text-error' : s === 'Completed' ? 'btn-primary' : 'btn-secondary'} disabled={busy}
            onClick={() => (s === 'Cancelled' || s === 'Completed' ? setConfirm(s) : change(s))}>
            {s === 'Cancelled' ? 'Cancel order' : s === 'Completed' ? 'Mark completed' : `Mark ${s}`}
          </button>
        ))}
      </>}>
      {loading && <Loading />}<ErrorBox error={error} />
      {o && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <StatusBadge status={o.status} />
            <span><span className="text-outline">Vendor</span> <b>{o.vendor_name}</b> ({o.business_name})</span>
            <span><span className="text-outline">Date</span> <b>{fmtDate(o.order_date)}</b></span>
          </div>
          <ol className="mb-5 flex flex-wrap gap-1.5 text-xs" aria-label="Order progress">
            {STATUSES.filter((s) => s !== 'Cancelled').map((s) => {
              const reached = o.status !== 'Cancelled' && STATUSES.indexOf(s) <= STATUSES.indexOf(o.status);
              return <li key={s} className={`rounded-full px-2.5 py-1 font-medium ${reached ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-outline'}`}>{s}</li>;
            })}
          </ol>
          <Table>
            <thead><tr><th className="th">Fruit</th><th className="th">Box</th><th className="th text-right">Qty</th><th className="th text-right">Unit price</th><th className="th text-right">Subtotal</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/40">
              {o.items.map((i) => <tr key={i.id}><td className="td font-semibold">{i.fruit}</td><td className="td">{i.box_size}</td><td className="td mono text-right">{i.quantity}</td><td className="td mono text-right">{money(i.unit_price)}</td><td className="td mono text-right">{money(i.subtotal)}</td></tr>)}
            </tbody>
            <tfoot><tr><td colSpan={4} className="td text-right font-semibold">Total</td><td className="td mono text-right text-base font-bold text-primary">{money(o.total_amount)}</td></tr></tfoot>
          </Table>
          <p className="mt-3 text-xs text-outline">Stock is reduced only when an order is completed. Cancelled orders never change stock.{!isAdmin && ' Completing an order is an administrator action.'}</p>
        </>
      )}
      {confirm && <ConfirmModal title={confirm === 'Completed' ? 'Complete this order?' : 'Cancel this order?'} danger={confirm === 'Cancelled'} busy={busy} confirmLabel={confirm === 'Completed' ? 'Complete order' : 'Cancel order'} onClose={() => setConfirm(null)} onConfirm={() => change(confirm)}
        message={confirm === 'Completed' ? 'The ordered boxes will be deducted from stock. This cannot be undone.' : 'The order will be cancelled and stock will not be affected. This cannot be undone.'} />}
      {removing && <ConfirmModal danger title="Delete order" confirmLabel="Delete" busy={busy} onClose={() => setRemoving(false)} onConfirm={remove} message="Permanently delete this order?" />}
    </Modal>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [fruitId, setFruitId] = useState('');
  const [boxId, setBoxId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const vendorId = params.get('vendor_id') || '';
  const q = useDebounced(search);
  const fruits = useFetch('/fruits');
  const boxes = useFetch('/box-sizes');
  const { data, error, loading, reload } = useFetch(`/orders${qs({ search: q, status, fruit_id: fruitId, box_size_id: boxId, vendor_id: vendorId, date_from: from, date_to: to })}`);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [viewing, setViewing] = useState(null);

  useEffect(() => { if (params.get('new')) { const p = new URLSearchParams(params); p.delete('new'); setParams(p, { replace: true }); } }, []); // eslint-disable-line

  return (
    <>
      <PageHeader title="Order management" subtitle="Orders placed by registered Maseru vendors, with live status tracking. Stock only drops when an order is completed."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Icon name="add" /> New order</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search order no., vendor or business..." />
        <Select value={status} onChange={setStatus} label="Filter by status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={fruitId} onChange={setFruitId} label="Filter by fruit"><option value="">All fruits</option>{fruits.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
        <Select value={boxId} onChange={setBoxId} label="Filter by box size"><option value="">All box sizes</option>{boxes.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        <input className="input !w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input className="input !w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>
      {vendorId && <div className="mb-3 flex items-center gap-2 text-sm">Showing one vendor's orders <button className="btn-secondary !py-0.5" onClick={() => setParams({})}>Clear</button></div>}
      <ErrorBox error={error} />
      <Table>
        <thead><tr><th className="th">Order</th><th className="th">Vendor</th><th className="th">Date</th><th className="th text-right">Items</th><th className="th text-right">Boxes</th><th className="th">Status</th><th className="th text-right">Total</th></tr></thead>
        <tbody className="divide-y divide-outline-variant/40">
          {loading ? <tr><td colSpan={7}><Loading /></td></tr> : data?.length === 0 ? <tr><td colSpan={7}><Empty>No orders match these filters.</Empty></td></tr> : data?.map((o) => (
            <tr key={o.id} className="cursor-pointer hover:bg-surface-container-low" onClick={() => setViewing(o.id)}>
              <td className="td mono"><button className="font-semibold text-surface-tint hover:underline" onClick={(e) => { e.stopPropagation(); setViewing(o.id); }}>{orderRef(o.id)}</button></td>
              <td className="td">{o.vendor_name}<div className="text-xs text-outline">{o.business_name}</div></td>
              <td className="td whitespace-nowrap">{fmtDate(o.order_date)}</td>
              <td className="td mono text-right">{o.item_count}</td>
              <td className="td mono text-right">{o.box_count}</td>
              <td className="td"><StatusBadge status={o.status} /></td>
              <td className="td mono text-right">{money(o.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {creating && <NewOrder onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />}
      {viewing && <OrderDetail id={viewing} onClose={() => setViewing(null)} onChanged={reload} />}
    </>
  );
}
