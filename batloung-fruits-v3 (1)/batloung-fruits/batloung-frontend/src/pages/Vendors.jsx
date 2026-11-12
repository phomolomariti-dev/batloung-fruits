import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useFetch, { useDebounced } from '../utils/useFetch';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal, Empty, ErrorBox, Field, Icon, Loading, Modal, PageHeader, SearchBox, Select, Table } from '../components/ui';
import { fmtDate, money, today } from '../utils/format';

const PHONE_RE = /^[+]?[0-9 ()-]{7,20}$/;
const MASERU = [-29.3167, 27.4833];
const EMPTY = { vendor_name: '', business_name: '', telephone: '', location_area: '', latitude: null, longitude: null, registration_date: today(), status: 'Active' };

function getPlaceLabel(result) {
  const address = result.address || {};
  const place = address.amenity || address.shop || address.building || address.tourism || result.name;
  const road = address.road;
  const locality = address.village || address.suburb || address.town || address.city || address.municipality;
  const label = [place, road, locality].filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ')
    || result.display_name
    || '';
  return label.slice(0, 100);
}

function MapClickHandler({ onSelect }) {
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return null;
}

function MapCenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export default function Vendors() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const q = useDebounced(search);
  const all = useFetch('/vendors');
  const { data, error, loading, reload } = useFetch(`/vendors${qs({ search: q, status, location })}`);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [mapSearchBusy, setMapSearchBusy] = useState(false);
  const [mapSearchError, setMapSearchError] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState([]);
  const [mapSelectionBusy, setMapSelectionBusy] = useState(false);
  const [mapView, setMapView] = useState({ center: MASERU, zoom: 12 });
  const mapSelectionRequest = useRef(0);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const areas = [...new Set((all.data || []).map((v) => v.location_area))].sort();
  const open = (v) => {
    setErrs({});
    setMapSearchError('');
    setMapSearchResults([]);
    mapSelectionRequest.current += 1;
    setMapSelectionBusy(false);
    setForm(v ? { ...EMPTY, ...v } : { ...EMPTY, registration_date: today() });
    setMapView({
      center: v?.latitude != null && v?.longitude != null ? [Number(v.latitude), Number(v.longitude)] : MASERU,
      zoom: v?.latitude != null && v?.longitude != null ? 16 : 12,
    });
    setEditing(v || {});
  };
  const selectMapLocation = async (latitude, longitude, fallbackLabel = '') => {
    const requestId = ++mapSelectionRequest.current;
    setForm((current) => ({ ...current, latitude, longitude }));
    setErrs((current) => ({ ...current, latitude: undefined }));
    setMapSelectionBusy(true);
    setMapSearchError('');
    try {
      const result = await api.get(`/vendors/geocode/reverse${qs({ lat: latitude, lon: longitude })}`);
      if (requestId !== mapSelectionRequest.current) return;
      const placeLabel = getPlaceLabel(result);
      if (placeLabel) setForm((current) => ({ ...current, location_area: placeLabel }));
      else if (fallbackLabel) setForm((current) => ({ ...current, location_area: fallbackLabel }));
    } catch (error) {
      if (requestId !== mapSelectionRequest.current) return;
      if (fallbackLabel) setForm((current) => ({ ...current, location_area: fallbackLabel }));
      setMapSearchError(error.message || 'Coordinates selected, but the place name could not be looked up.');
    } finally {
      if (requestId === mapSelectionRequest.current) setMapSelectionBusy(false);
    }
  };
  const findOnMap = async () => {
    const query = form.location_area.trim();
    if (!query) {
      setMapSearchError('Enter an area, village or landmark first.');
      return;
    }
    setMapSearchBusy(true);
    setMapSearchError('');
    setMapSearchResults([]);
    try {
      const results = await api.get(`/vendors/geocode${qs({ q: query })}`);
      if (!Array.isArray(results) || !results.length) {
        setMapSearchError('No matching result found. Zoom or pan the map to the right place, then click the exact spot.');
        return;
      }
      setMapSearchResults(results);
      setMapView({ center: [Number(results[0].lat), Number(results[0].lon)], zoom: 16 });
    } catch (error) {
      setMapSearchError(
        error.message === 'Invalid id'
          ? 'The backend is still running an older version. Restart the backend server, then try the location search again.'
          : error.message || 'Could not search the map. You can still select a point manually.'
      );
    } finally {
      setMapSearchBusy(false);
    }
  };
  const save = async () => {
    const e = {};
    if (!form.vendor_name.trim()) e.vendor_name = 'Vendor name is required';
    if (!form.business_name.trim()) e.business_name = 'Business name is required';
    if (!PHONE_RE.test(form.telephone)) e.telephone = 'Enter a valid telephone number';
    if (!form.location_area.trim()) e.location_area = 'Location / area in Maseru is required';
    if (form.latitude == null || form.longitude == null) e.latitude = 'Search for the area or click the exact location on the map';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (editing.id) await api.put(`/vendors/${editing.id}`, form); else await api.post('/vendors', form);
      toast(editing.id ? 'Vendor updated' : 'Vendor registered');
      setEditing(null); reload(); all.reload();
    } catch (err) { setErrs(err.details && Object.keys(err.details).length ? err.details : { form: err.message }); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.del(`/vendors/${removing.id}`); toast('Vendor deleted'); reload(); all.reload(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); setRemoving(null); }
  };
  const field = (key, label, props = {}) => (
    <Field label={`${label} *`} error={errs[key]}>
      <input className={`input ${errs[key] ? 'input-error' : ''}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </Field>
  );

  return (
    <>
      <PageHeader title="Maseru street vendors" subtitle="Registered traders who buy fruit by the box. A vendor must be registered and active before an order can be placed."
        actions={<button className="btn-primary" onClick={() => open()}><Icon name="person_add" /> Register vendor</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, business, phone, area or ID..." />
        <Select value={location} onChange={setLocation} label="Filter by area"><option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</Select>
        <Select value={status} onChange={setStatus} label="Filter by status"><option value="">All statuses</option><option>Active</option><option>Inactive</option></Select>
      </div>
      <ErrorBox error={error} />
      <Table>
        <thead><tr><th className="th">ID</th><th className="th">Vendor</th><th className="th">Telephone</th><th className="th">Area</th><th className="th">Registered</th><th className="th text-right">Orders</th><th className="th text-right">Sales</th><th className="th">Status</th>{isAdmin && <th className="th text-right">Actions</th>}</tr></thead>
        <tbody className="divide-y divide-outline-variant/40">
          {loading ? <tr><td colSpan={9}><Loading /></td></tr> : data?.length === 0 ? <tr><td colSpan={9}><Empty>No vendors match.</Empty></td></tr> : data?.map((v) => (
            <tr key={v.id}>
              <td className="td mono">V-{String(v.id).padStart(3, '0')}</td>
              <td className="td"><div className="font-semibold">{v.vendor_name}</div><div className="text-xs text-outline">{v.business_name}</div></td>
              <td className="td mono whitespace-nowrap">{v.telephone}</td>
              <td className="td">
                <div>{v.location_area}</div>
                {v.latitude != null && v.longitude != null && (
                  <div className="mt-1 font-mono text-xs text-outline">{Number(v.latitude).toFixed(7)}, {Number(v.longitude).toFixed(7)}</div>
                )}
              </td>
              <td className="td whitespace-nowrap">{fmtDate(v.registration_date)}</td>
              <td className="td mono text-right">{v.order_count}</td>
              <td className="td mono text-right">{money(v.total_sales)}</td>
              <td className="td"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.status === 'Active' ? 'bg-primary-fixed text-primary-container' : 'bg-surface-container-high text-outline'}`}>{v.status}</span></td>
              {isAdmin && <td className="td whitespace-nowrap text-right">
                <Link to={`/orders?vendor_id=${v.id}`} className="btn-ghost !p-1.5 text-lg" aria-label={`Orders for ${v.vendor_name}`}><Icon name="receipt_long" /></Link>
                <button className="btn-ghost !p-1.5 text-lg" onClick={() => open(v)} aria-label={`Edit ${v.vendor_name}`}><Icon name="edit" /></button>
                <button className="btn-ghost !p-1.5 text-lg text-error" onClick={() => setRemoving(v)} aria-label={`Delete ${v.vendor_name}`}><Icon name="delete" /></button>
              </td>}
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && (
        <Modal title={editing.id ? 'Edit vendor' : 'Register street vendor'} onClose={() => setEditing(null)} footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{editing.id ? 'Save' : 'Register'}</button></>}>
          <ErrorBox error={errs.form} />
          <div className="grid gap-4 sm:grid-cols-2">
            {field('vendor_name', 'Vendor name', { maxLength: 100 })}
            {field('business_name', 'Business name', { maxLength: 120 })}
            {field('telephone', 'Telephone', { placeholder: '+266 ...' })}
            <div className="sm:col-span-2">
              <Field label="Location / area in Maseru *" error={errs.location_area}>
                <input
                  className={`input ${errs.location_area ? 'input-error' : ''}`}
                  value={form.location_area}
                  onChange={(e) => {
                    mapSelectionRequest.current += 1;
                    setMapSelectionBusy(false);
                    setForm({ ...form, location_area: e.target.value, latitude: null, longitude: null });
                    setMapSearchError('');
                    setMapSearchResults([]);
                  }}
                  maxLength={100}
                  placeholder="Enter a village, street, shop or landmark"
                />
              </Field>
              <button type="button" className="btn-secondary mt-2" onClick={findOnMap} disabled={mapSearchBusy}>
                <Icon name="search" /> {mapSearchBusy ? 'Searching map...' : 'Find area on map'}
              </button>
              <p className="mt-2 text-xs text-on-surface-variant">Search for a village or business to move the map there, then click the exact spot. The selected place/address and exact coordinates will be saved.</p>
              {mapSearchError && <p className="mt-2 text-sm text-error" role="alert">{mapSearchError}</p>}
              {mapSearchResults.length > 0 && (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-outline-variant/60" aria-label="Map search results">
                  {mapSearchResults.map((result, index) => (
                    <button
                      key={`${index}-${result.lat}-${result.lon}`}
                      type="button"
                      className="block w-full border-b border-outline-variant/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-container-low"
                      onClick={() => {
                        const center = [Number(result.lat), Number(result.lon)];
                        setMapView({ center, zoom: 17 });
                        selectMapLocation(center[0], center[1], getPlaceLabel(result));
                      }}
                    >
                      {result.display_name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 h-72 overflow-hidden rounded-lg border border-outline-variant/60">
                <MapContainer center={MASERU} zoom={12} className="h-full w-full" scrollWheelZoom>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickHandler onSelect={(latitude, longitude) => selectMapLocation(latitude, longitude, form.location_area.trim())} />
                  <MapCenter center={mapView.center} zoom={mapView.zoom} />
                  {mapSearchResults.map((result, index) => (
                    <CircleMarker
                      key={`${index}-${result.lat}-${result.lon}`}
                      center={[Number(result.lat), Number(result.lon)]}
                      radius={7}
                      pathOptions={{ color: '#155eef', fillColor: '#528bff', fillOpacity: 0.8 }}
                      eventHandlers={{
                        click: () => selectMapLocation(Number(result.lat), Number(result.lon)),
                      }}
                    />
                  ))}
                  {form.latitude != null && form.longitude != null && (
                    <CircleMarker center={[form.latitude, form.longitude]} radius={9} pathOptions={{ color: '#b42318', fillColor: '#ef4444', fillOpacity: 0.9 }} />
                  )}
                </MapContainer>
              </div>
              {form.latitude != null && form.longitude != null ? (
                <p className="mt-2 text-sm font-medium" aria-live="polite">
                  {mapSelectionBusy ? 'Updating selected place... ' : 'Selected coordinates: '}
                  {!mapSelectionBusy && <span className="font-mono">{Number(form.latitude).toFixed(7)}, {Number(form.longitude).toFixed(7)}</span>}
                </p>
              ) : (
                <p className={`mt-2 text-sm ${errs.latitude ? 'text-error' : 'text-outline'}`}>{errs.latitude || 'Click the map to select a precise vendor location.'}</p>
              )}
            </div>
            {isAdmin && <Field label="Registration date"><input className="input" type="date" value={form.registration_date} onChange={(e) => setForm({ ...form, registration_date: e.target.value })} /></Field>}
            {isAdmin && <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Inactive</option></select></Field>}
          </div>
        </Modal>
      )}
      {removing && <ConfirmModal danger title="Delete vendor" confirmLabel="Delete" busy={busy} onClose={() => setRemoving(null)} onConfirm={remove} message={`Delete ${removing.vendor_name}? Vendors with orders cannot be deleted; set them to Inactive instead.`} />}
    </>
  );
}
