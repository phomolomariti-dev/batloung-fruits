import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../utils/useFetch';
import { qs } from '../api/client';
import { Empty, ErrorBox, Icon, Loading, PageHeader, Table, Tabs } from '../components/ui';
import { downloadCsv, fmtDate, money, num, orderRef } from '../utils/format';

const m = (k) => (r) => money(r[k]);
const n = (k) => (r) => num(r[k]);
const REPORTS = {
  'available-stock': { label: 'Available stock', dates: false, chart: ['sku', 'stock_quantity'], cols: [['Fruit', (r) => r.fruit], ['Box size', (r) => r.box_size], ['SKU', (r) => r.sku], ['In stock', n('stock_quantity'), 1], ['Reorder at', n('reorder_threshold'), 1], ['Price', m('selling_price'), 1], ['Stock value', m('stock_value'), 1]] },
  'sales-by-fruit': { label: 'Sales by fruit', dates: true, chart: ['fruit', 'sales_value'], cols: [['Fruit', (r) => r.fruit], ['Orders', n('orders'), 1], ['Boxes sold', n('boxes_sold'), 1], ['Sales value', m('sales_value'), 1]] },
  'sales-by-box-size': { label: 'Sales by box size', dates: true, chart: ['box_size', 'sales_value'], cols: [['Box size', (r) => r.box_size], ['Boxes sold', n('boxes_sold'), 1], ['Sales value', m('sales_value'), 1]] },
  'sales-by-vendor': { label: 'Sales by vendor', dates: true, chart: ['vendor_name', 'sales_value'], cols: [['Vendor', (r) => r.vendor_name], ['Business', (r) => r.business_name], ['Area', (r) => r.location_area], ['Completed orders', n('completed_orders'), 1], ['Sales value', m('sales_value'), 1]] },
  'purchases-by-province': { label: 'Purchases by province', dates: true, chart: ['province', 'purchase_value'], cols: [['Province', (r) => r.province], ['Purchases', n('purchases'), 1], ['Boxes bought', n('boxes_purchased'), 1], ['Purchase value', m('purchase_value'), 1]] },
  'pending-orders': { label: 'Pending orders', dates: false, cols: [['Order', (r) => orderRef(r.id)], ['Vendor', (r) => r.vendor_name], ['Business', (r) => r.business_name], ['Date', (r) => fmtDate(r.order_date)], ['Status', (r) => r.status], ['Boxes', n('boxes'), 1], ['Total', m('total_amount'), 1]] },
  'completed-orders': { label: 'Completed orders', dates: true, cols: [['Order', (r) => orderRef(r.id)], ['Vendor', (r) => r.vendor_name], ['Business', (r) => r.business_name], ['Date', (r) => fmtDate(r.order_date)], ['Boxes', n('boxes'), 1], ['Total', m('total_amount'), 1]] },
  'sales-by-date': { label: 'Total sales by date', dates: true, chart: ['date', 'sales_value'], cols: [['Date', (r) => fmtDate(r.date)], ['Orders', n('orders'), 1], ['Sales value', m('sales_value'), 1]] },
};

export default function Reports() {
  const [tab, setTab] = useState('available-stock');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const def = REPORTS[tab];
  const { data, error, loading } = useFetch(`/reports/${tab}${def.dates ? qs({ from, to }) : ''}`);
  const rows = data?.rows || [];
  const totalKey = def.cols.find((c) => c[0].match(/value|Total/i));

  return (
    <>
      <PageHeader title="Business reports" subtitle="Sales figures count completed orders only. Cancelled and open orders are excluded."
        actions={<button className="btn-secondary" disabled={!rows.length} onClick={() => downloadCsv(`${tab}.csv`, rows)}><Icon name="file_download" /> Export CSV</button>} />
      <Tabs value={tab} onChange={setTab} tabs={Object.entries(REPORTS).map(([id, r]) => [id, r.label])} />
      {def.dates && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">From <input className="input !w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex items-center gap-2">To <input className="input !w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          {(from || to) && <button className="btn-secondary" onClick={() => { setFrom(''); setTo(''); }}>Clear</button>}
        </div>
      )}
      <ErrorBox error={error} />
      {loading ? <Loading /> : (
        <>
          {def.chart && rows.length > 0 && (
            <div className="card mb-4 h-60 p-4">
              <ResponsiveContainer>
                <BarChart data={[...rows].reverse().slice(-15)} margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c0c9c0" />
                  <XAxis dataKey={def.chart[0]} tick={{ fontSize: 11 }} interval={0} tickFormatter={(v) => (String(v).length > 12 ? `${String(v).slice(0, 11)}...` : v)} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => (def.chart[1].includes('value') ? money(v) : num(v))} />
                  <Bar dataKey={def.chart[1]} fill="#2d6a48" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <Table>
            <thead><tr>{def.cols.map(([h, , right]) => <th key={h} className={`th ${right ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-outline-variant/40">
              {rows.length === 0 ? <tr><td colSpan={def.cols.length}><Empty>No data for this report yet.</Empty></td></tr> : rows.map((r, i) => (
                <tr key={i}>{def.cols.map(([h, fn, right]) => <td key={h} className={`td ${right ? 'mono text-right' : ''}`}>{fn(r)}</td>)}</tr>
              ))}
            </tbody>
            {rows.length > 0 && totalKey && (
              <tfoot><tr>
                {def.cols.map(([h, , right], idx) => {
                  const key = { 'Sales value': 'sales_value', 'Purchase value': 'purchase_value', Total: 'total_amount', 'Stock value': 'stock_value' }[h];
                  return <td key={h} className={`td font-semibold ${right ? 'mono text-right' : ''}`}>{idx === 0 ? 'Total' : key ? money(rows.reduce((s, r) => s + Number(r[key] || 0), 0)) : ''}</td>;
                })}
              </tr></tfoot>
            )}
          </Table>
        </>
      )}
    </>
  );
}
