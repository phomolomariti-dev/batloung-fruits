import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../utils/useFetch';
import { useAuth } from '../context/AuthContext';
import { Empty, ErrorBox, Icon, Loading, PageHeader, StatCard, StatusBadge } from '../components/ui';
import { fmtDate, money, num, orderRef } from '../utils/format';

const SIZE_COLORS = { Small: '#95d4ac', Medium: '#2d6a48', Large: '#003820' };

function pivotStock(rows) {
  const map = {};
  rows.forEach((r) => { (map[r.fruit] ||= { fruit: r.fruit })[r.box_size] = r.stock_quantity; });
  return Object.values(map);
}

export default function Dashboard() {
  const { data, error, loading } = useFetch('/dashboard');
  const { isAdmin, user } = useAuth();
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const t = data.totals;
  const maxProv = Math.max(1, ...data.purchases_by_province.map((p) => p.purchase_value));
  const stockData = pivotStock(data.stock_by_fruit);

  return (
    <>
      <PageHeader
        title="Your orchard, in motion"
        subtitle="A fresh look at every crate, customer and delivery."
        actions={<>
          {isAdmin && <Link to="/stock" className="btn-secondary"><Icon name="add_shopping_cart" /> Record stock</Link>}
          <Link to="/vendors" className="btn-secondary"><Icon name="person_add" /> Register vendor</Link>
          <Link to="/orders?new=1" className="btn-primary"><Icon name="add" /> New order</Link>
        </>}
      />

      <section className="dashboard-hero mb-6 rounded-[2rem] border border-[#d9dfc9] px-6 py-7 sm:px-9 sm:py-9">
        <div className="relative z-10 max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-container shadow-sm">
            <span className="h-2 w-2 rounded-full bg-secondary" />
            Maseru distribution hub · Lesotho
          </div>
          <p className="mb-2 text-sm font-semibold text-secondary">GROWING GOOD THINGS, TOGETHER</p>
          <h2 className="max-w-lg text-3xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-5xl">
            Good things grow<br />when the numbers do.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-on-surface-variant">
            Welcome back, {user.name.split(' ')[0]}. Your fruit trade is moving—here’s the freshest picture of your business.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/75 px-3 py-2 text-primary-container">{num(t.available_stock)} boxes ready to move</span>
            <span className="rounded-full bg-white/75 px-3 py-2 text-primary-container">{t.pending_orders} orders need a look</span>
          </div>
        </div>
        <svg className="pointer-events-none absolute -right-3 bottom-0 hidden h-full w-[44%] max-w-[420px] md:block" viewBox="0 0 430 300" fill="none" aria-hidden="true">
          <path d="M248 303C264 224 296 157 365 88" stroke="#759765" strokeWidth="7" strokeLinecap="round" />
          <path d="M294 211C250 159 213 161 191 176C210 214 247 226 294 211Z" fill="#628B55" />
          <path d="M331 150C330 100 352 72 381 64C395 105 376 138 331 150Z" fill="#759765" />
          <path d="M270 256C236 217 199 218 178 236C204 267 235 276 270 256Z" fill="#8EA96C" />
          <circle cx="322" cy="213" r="65" fill="#F0A63B" />
          <circle cx="322" cy="213" r="49" fill="#F7C75A" />
          <circle cx="322" cy="213" r="38" fill="#F9E39D" />
          <path d="M317 173C317 160 327 151 342 150C343 165 333 175 317 173Z" fill="#628B55" />
          <circle cx="220" cy="117" r="38" fill="#D77A4B" />
          <circle cx="220" cy="117" r="30" fill="#E8A174" />
          <path d="M218 81C222 69 232 65 242 69C239 80 230 85 218 81Z" fill="#628B55" />
          <circle cx="393" cy="257" r="23" fill="#E6C94F" />
          <path d="M392 236C393 228 400 222 408 224C407 233 401 238 392 236Z" fill="#628B55" />
          <circle cx="155" cy="245" r="9" fill="#D77A4B" opacity=".55" />
          <circle cx="265" cy="69" r="6" fill="#759765" opacity=".55" />
        </svg>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total fruits" value={t.fruits} icon="nutrition" hint="Active varieties" />
        <StatCard label="Suppliers" value={t.suppliers} icon="local_shipping" hint="Across SA provinces" />
        <StatCard label="Registered vendors" value={t.vendors} icon="storefront" hint="Active street vendors" />
        <StatCard label="Available stock" value={`${num(t.available_stock)} boxes`} icon="inventory_2" hint="All fruit and sizes" />
        <StatCard label="Total orders" value={t.orders} icon="receipt_long" />
        <StatCard label="Pending orders" value={t.pending_orders} icon="pending_actions" tone="warn" hint="Not yet completed" />
        <StatCard label="Completed orders" value={t.completed_orders} icon="task_alt" hint="Stock already deducted" />
        <StatCard label="Sales value" value={money(t.sales_value)} icon="payments" tone="money" hint="Completed orders only" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <section className="card p-4 lg:col-span-3">
          <h2 className="font-semibold">Stock by fruit and box size</h2>
          <p className="mb-3 text-xs text-outline">Boxes on hand right now</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stockData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c0c9c0" />
                <XAxis dataKey="fruit" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {['Small', 'Medium', 'Large'].map((s) => <Bar key={s} dataKey={s} stackId="a" fill={SIZE_COLORS[s]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-4 lg:col-span-2">
          <h2 className="font-semibold">Purchases by SA province</h2>
          <p className="mb-3 text-xs text-outline">Cost of fruit bought from suppliers</p>
          <ul className="space-y-2.5">
            {data.purchases_by_province.map((p) => (
              <li key={p.province}>
                <div className="flex justify-between text-sm"><span>{p.province}</span><span className="mono">{money(p.purchase_value)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-container-high"><div className="h-1.5 rounded-full bg-surface-tint" style={{ width: `${(p.purchase_value / maxProv) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="card p-4 lg:col-span-3">
          <h2 className="font-semibold">Sales, last 30 days</h2>
          <p className="mb-3 text-xs text-outline">Completed orders by order date</p>
          {data.sales_by_date.length === 0 ? <Empty>No completed orders in this period.</Empty> : (
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={data.sales_by_date.map((d) => ({ ...d, date: fmtDate(d.date).slice(0, 6) }))} margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c0c9c0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Line type="monotone" dataKey="sales_value" name="Sales" stroke="#0f5132" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="card p-4 lg:col-span-2">
          <h2 className="font-semibold">Orders by status</h2>
          <ul className="mt-3 space-y-2">
            {data.orders_by_status.map((s) => (
              <li key={s.status} className="flex items-center justify-between"><StatusBadge status={s.status} /><span className="mono">{s.count}</span></li>
            ))}
          </ul>
          {data.low_stock.length > 0 && (
            <div className="mt-4 rounded-lg bg-tertiary-fixed px-3 py-2 text-sm text-tertiary">
              <div className="flex items-center gap-1.5 font-semibold"><Icon name="warning" /> Low stock</div>
              <div className="mt-0.5">{data.low_stock.map((l) => `${l.fruit} (${l.box_size}): ${l.stock_quantity}`).join(', ')}</div>
            </div>
          )}
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4"><h2 className="font-semibold">Recent orders</h2><Link to="/orders" className="text-sm font-semibold text-surface-tint hover:underline">View all</Link></div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full">
            <thead><tr><th className="th">Order</th><th className="th">Vendor</th><th className="th">Date</th><th className="th">Status</th><th className="th text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/40">
              {data.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td className="td mono">{orderRef(o.id)}</td>
                  <td className="td">{o.vendor_name}<div className="text-xs text-outline">{o.business_name}</div></td>
                  <td className="td">{fmtDate(o.order_date)}</td>
                  <td className="td"><StatusBadge status={o.status} /></td>
                  <td className="td mono text-right">{money(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
