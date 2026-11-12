// End-to-end API check of the assignment's business rules. Run with the API started: node scripts/smoke-test.js
const base = process.env.API || 'http://localhost:5001/api';
let pass = 0, fail = 0;
const call = async (method, path, token, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };

(async () => {
  const noAuth = await call('GET', '/fruits');
  ok('401 without token', noAuth.status === 401);
  ok('bad login -> 401', (await call('POST', '/auth/login', null, { email: 'admin@batloung.co.ls', password: 'x', accept_terms: true })).status === 401);
  const noTerms = await call('POST', '/auth/login', null, { email: 'admin@batloung.co.ls', password: 'Admin@123' });
  ok('login without accepting terms -> 403 TERMS_REQUIRED', noTerms.status === 403 && noTerms.data.details?.code === 'TERMS_REQUIRED', JSON.stringify(noTerms.data));
  ok('terms must be literally true -> 403', (await call('POST', '/auth/login', null, { email: 'admin@batloung.co.ls', password: 'Admin@123', accept_terms: 'yes' })).status === 403);
  const prov = await call('GET', '/auth/providers');
  ok('provider list is public and lists all 4', prov.status === 200 && ['google', 'github', 'apple', 'facebook'].every((k) => typeof prov.data[k] === 'boolean'));
  ok('login validation -> 400', (await call('POST', '/auth/login', null, { email: 'nope' })).status === 400);
  const admin = (await call('POST', '/auth/login', null, { email: 'admin@batloung.co.ls', password: 'Admin@123', accept_terms: true, terms_version: 'test' })).data.token;
  const sales = (await call('POST', '/auth/login', null, { email: 'sales@batloung.co.ls', password: 'Sales@123', accept_terms: true, terms_version: 'test' })).data.token;

  ok('sales cannot read suppliers (403)', (await call('GET', '/suppliers', sales)).status === 403);
  ok('sales cannot read reports (403)', (await call('GET', '/reports/sales-by-fruit', sales)).status === 403);
  ok('sales can view products', (await call('GET', '/products', sales)).status === 200);

  const products = (await call('GET', '/products', admin)).data;
  ok('15 products (5 fruits x 3 box sizes)', products.length === 15);
  const apples = products.find((p) => p.fruit === 'Apples' && p.box_size === 'Medium');
  const vendors = (await call('GET', '/vendors', admin)).data;
  const v = vendors.find((x) => x.status === 'Active');
  const inactive = vendors.find((x) => x.status === 'Inactive');

  // validation rules
  ok('order without items -> 400', (await call('POST', '/orders', sales, { vendor_id: v.id, items: [] })).status === 400);
  ok('order without vendor -> 400', (await call('POST', '/orders', sales, { items: [{ product_id: apples.id, quantity: 1 }] })).status === 400);
  ok('unregistered vendor -> 400', (await call('POST', '/orders', sales, { vendor_id: 99999, items: [{ product_id: apples.id, quantity: 1 }] })).status === 400);
  ok('inactive vendor -> 400', (await call('POST', '/orders', sales, { vendor_id: inactive.id, items: [{ product_id: apples.id, quantity: 1 }] })).status === 400);
  ok('quantity 0 -> 400', (await call('POST', '/orders', sales, { vendor_id: v.id, items: [{ product_id: apples.id, quantity: 0 }] })).status === 400);
  ok('quantity -5 -> 400', (await call('POST', '/orders', sales, { vendor_id: v.id, items: [{ product_id: apples.id, quantity: -5 }] })).status === 400);
  const tooMany = await call('POST', '/orders', sales, { vendor_id: v.id, items: [{ product_id: apples.id, quantity: apples.stock_quantity + 1 }] });
  ok('quantity > stock -> 409', tooMany.status === 409, JSON.stringify(tooMany.data));

  // happy path with 2 items, totals
  const small = products.find((p) => p.fruit === 'Grapes' && p.box_size === 'Small');
  const created = await call('POST', '/orders', sales, { vendor_id: v.id, items: [{ product_id: apples.id, quantity: 10 }, { product_id: small.id, quantity: 4 }] });
  ok('create order -> 201', created.status === 201, JSON.stringify(created.data));
  const o = created.data;
  const expected = 10 * apples.selling_price + 4 * small.selling_price;
  ok('total = sum of subtotals', o.total_amount === expected && o.items.every((i) => i.subtotal === i.quantity * i.unit_price), `${o.total_amount} vs ${expected}`);
  ok('new order is Pending', o.status === 'Pending');

  const stockOf = async (id) => (await call('GET', '/products', admin)).data.find((p) => p.id === id).stock_quantity;
  ok('stock NOT reduced while pending', (await stockOf(apples.id)) === apples.stock_quantity);

  ok('sales cannot complete (403)', (await call('PUT', `/orders/${o.id}`, sales, { status: 'Completed' })).status === 403);
  ok('sales can confirm', (await call('PUT', `/orders/${o.id}`, sales, { status: 'Confirmed' })).status === 200);
  ok('admin -> Processing', (await call('PUT', `/orders/${o.id}`, admin, { status: 'Processing' })).status === 200);
  ok('cannot go backwards (409)', (await call('PUT', `/orders/${o.id}`, admin, { status: 'Pending' })).status === 409);
  ok('admin -> Ready', (await call('PUT', `/orders/${o.id}`, admin, { status: 'Ready for Collection/Delivery' })).status === 200);
  const done = await call('PUT', `/orders/${o.id}`, admin, { status: 'Completed' });
  ok('admin -> Completed', done.status === 200 && done.data.status === 'Completed', JSON.stringify(done.data));
  ok('completed order reduced stock', (await stockOf(apples.id)) === apples.stock_quantity - 10 && (await stockOf(small.id)) === small.stock_quantity - 4);
  ok('completed order is final (409)', (await call('PUT', `/orders/${o.id}`, admin, { status: 'Cancelled' })).status === 409);
  ok('cannot delete completed order (409)', (await call('DELETE', `/orders/${o.id}`, admin)).status === 409);

  // cancelled order must not touch stock
  const before = await stockOf(apples.id);
  const c = (await call('POST', '/orders', sales, { vendor_id: v.id, items: [{ product_id: apples.id, quantity: 5 }] })).data;
  ok('cancel -> 200', (await call('PUT', `/orders/${c.id}`, sales, { status: 'Cancelled' })).status === 200);
  ok('cancelled order did not change stock', (await stockOf(apples.id)) === before);

  // stock-in
  const sup = (await call('GET', '/suppliers?province_id=9', admin)).data[0];
  const sb = await stockOf(apples.id);
  const rec = await call('POST', '/stock', admin, { supplier_id: sup.id, product_id: apples.id, quantity: 100, cost_per_box: 40, batch_no: 'TEST-1', purchase_date: '2026-10-01' });
  ok('record purchase -> 201', rec.status === 201, JSON.stringify(rec.data));
  ok('purchase increases stock by 100', (await stockOf(apples.id)) === sb + 100);
  ok('purchase qty 0 -> 400', (await call('POST', '/stock', admin, { supplier_id: sup.id, product_id: apples.id, quantity: 0, cost_per_box: 40, batch_no: 'X', purchase_date: '2026-10-01' })).status === 400);

  // CRUD
  const ns = await call('POST', '/suppliers', admin, { supplier_name: 'Test Farm', province_id: 3, contact_person: 'T Tester', telephone: '+27 11 000 1111', email: 't@test.co.za', physical_address: '1 Test Rd', fruit_ids: [1, 2] });
  ok('create supplier -> 201', ns.status === 201, JSON.stringify(ns.data));
  ok('supplier validation -> 400', (await call('POST', '/suppliers', admin, { supplier_name: 'x' })).status === 400);
  ok('filter suppliers by province', (await call('GET', '/suppliers?province_id=3', admin)).data.length === 1);
  ok('update supplier', (await call('PUT', `/suppliers/${ns.data.id}`, admin, { supplier_name: 'Test Farm 2', province_id: 3, contact_person: 'T', telephone: '+27 11 000 1111', email: 't@test.co.za', physical_address: '1 Test Rd' })).status === 200);
  ok('delete unused supplier', (await call('DELETE', `/suppliers/${ns.data.id}`, admin)).status === 200);
  ok('delete supplier with purchases -> 409', (await call('DELETE', `/suppliers/${sup.id}`, admin)).status === 409);
  ok('supplier 404', (await call('GET', '/suppliers/99999', admin)).status === 404);
  const nv = await call('POST', '/vendors', sales, { vendor_name: 'New Vendor', business_name: 'NV Stall', telephone: '+266 5000 1111', location_area: 'Maseru CBD', latitude: -29.31, longitude: 27.48 });
  ok('sales registers vendor with coordinates -> 201', nv.status === 201, JSON.stringify(nv.data));
  ok('vendor coordinates returned at map precision', nv.data.latitude === -29.31 && nv.data.longitude === 27.48);
  ok('vendor rejects out-of-range coordinates', (await call('POST', '/vendors', sales, { vendor_name: 'Bad Coords', business_name: 'Test', telephone: '+266 5000 1111', location_area: 'Maseru', latitude: -91, longitude: 27.48 })).status === 400);
  ok('sales cannot edit vendor (403)', (await call('PUT', `/vendors/${nv.data.id}`, sales, {})).status === 403);
  const nf = await call('POST', '/fruits', admin, { name: 'Pineapples' });
  ok('new fruit created inactive', nf.status === 201 && nf.data.is_active === 0);
  ok('delete unused fruit', (await call('DELETE', `/fruits/${nf.data.id}`, admin)).status === 200);
  ok('fruit on open orders cannot be deleted (409)', (await call('DELETE', '/fruits/5', admin)).status === 409);
  const nf2 = await call('POST', '/fruits', admin, { name: 'Pears' });
  const np = await call('POST', '/products', admin, { fruit_id: nf2.data.id, box_size_id: 1, selling_price: 60 });
  ok('create product (fruit + box size + price) -> 201', np.status === 201, JSON.stringify(np.data));
  ok('product without price -> 400', (await call('POST', '/products', admin, { fruit_id: nf2.data.id, box_size_id: 2 })).status === 400);
  ok('product without box size -> 400', (await call('POST', '/products', admin, { fruit_id: nf2.data.id, selling_price: 10 })).status === 400);
  ok('duplicate fruit+box -> 409', (await call('POST', '/products', admin, { fruit_id: nf2.data.id, box_size_id: 1, selling_price: 60 })).status === 409);
  ok('delete used fruit deactivates', (await call('DELETE', `/fruits/${nf2.data.id}`, admin)).data.deactivated === true);
  for (const r of ['available-stock', 'sales-by-fruit', 'sales-by-box-size', 'sales-by-vendor', 'purchases-by-province', 'pending-orders', 'completed-orders', 'sales-by-date']) {
    const rr = await call('GET', `/reports/${r}`, admin);
    ok(`report ${r}`, rr.status === 200 && Array.isArray(rr.data.rows), JSON.stringify(rr.data));
  }
  const d = await call('GET', '/dashboard', sales);
  ok('dashboard', d.status === 200 && d.data.totals.completed_orders >= 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
