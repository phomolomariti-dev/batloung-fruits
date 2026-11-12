import { PageHeader } from '../components/ui';

const TABLES = [
  ['users', 'id PK, full_name, email UNIQUE, password_hash, role (administrator | sales)'],
  ['provinces', 'id PK, name UNIQUE, code UNIQUE  (all nine SA provinces)'],
  ['suppliers', 'id PK, supplier_name, province_id FK, contact_person, telephone, email, physical_address'],
  ['fruits', 'id PK, name UNIQUE, description, is_active'],
  ['box_sizes', 'id PK, name (Small | Medium | Large) UNIQUE, weight_kg'],
  ['products', 'id PK, fruit_id FK, box_size_id FK, sku UNIQUE, selling_price > 0, stock_quantity >= 0, UNIQUE(fruit_id, box_size_id)'],
  ['supplier_fruits', 'supplier_id FK + fruit_id FK (composite PK)'],
  ['purchases', 'id PK, supplier_id FK, product_id FK, quantity > 0, cost_per_box, batch_no, purchase_date'],
  ['street_vendors', 'id PK, vendor_name, business_name, telephone, location_area, registration_date, status'],
  ['orders', 'id PK, vendor_id FK, order_date, status (6 values), total_amount'],
  ['order_items', 'id PK, order_id FK, product_id FK, quantity > 0, unit_price, subtotal'],
];

const RULES = [
  'An order must belong to a registered, active street vendor.',
  'An order must contain at least one item, and every quantity must be greater than zero.',
  'A vendor cannot order more boxes than are in stock (checked on creation and again on completion).',
  'Completing an order reduces stock inside a database transaction.',
  'Cancelled orders never reduce stock.',
  'Every product has a fruit, a box size and a selling price.',
  'Subtotal = quantity x unit price. Order total = sum of subtotals, calculated on the server.',
];

const Box = ({ title, children }) => (
  <div className="card min-w-[150px] flex-1 p-4 text-center">
    <div className="font-semibold text-primary">{title}</div>
    <div className="mt-1 text-xs text-on-surface-variant">{children}</div>
  </div>
);
const Arrow = () => <div className="flex items-center justify-center text-2xl text-outline max-sm:rotate-90" aria-hidden="true">&harr;</div>;

export default function Architecture() {
  return (
    <>
      <PageHeader title="Architecture & ERD" subtitle="How the three tiers fit together, the database tables behind them, and the business rules the system enforces." />
      <section className="mb-6">
        <h2 className="mb-3 font-semibold">System architecture</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Box title="React (Vite)">Pages, routing, forms and client-side validation</Box><Arrow />
          <Box title="Express REST API">JWT auth, RBAC, server-side validation, business rules</Box><Arrow />
          <Box title="MySQL">Tables, keys, constraints and transactions</Box>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold">Database tables</h2>
          <div className="card divide-y divide-outline-variant/40">
            {TABLES.map(([t, cols]) => (
              <div key={t} className="px-4 py-3"><div className="mono font-semibold text-primary-container">{t}</div><div className="mt-0.5 text-xs text-on-surface-variant">{cols}</div></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-outline">Relationships: suppliers 1-N purchases, fruits 1-N products, box_sizes 1-N products, products 1-N purchases and order_items, street_vendors 1-N orders, orders 1-N order_items. The full diagram is in docs/ERD.md and docs/erd.svg.</p>
        </section>
        <section>
          <h2 className="mb-3 font-semibold">Business rules enforced</h2>
          <ul className="card list-disc space-y-2 py-4 pl-9 pr-4 text-sm">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
      </div>
    </>
  );
}
