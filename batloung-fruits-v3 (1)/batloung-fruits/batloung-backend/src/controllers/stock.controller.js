const { pool, withTransaction } = require('../config/db');
const { notFound, conflict, badRequest, asyncHandler } = require('../utils/errors');
const { validateBody, parseId } = require('../utils/validate');

const purchaseRules = {
  supplier_id: { type: 'int', required: true, min: 1, label: 'Supplier' },
  product_id: { type: 'int', required: true, min: 1, label: 'Product (fruit + box size)' },
  quantity: { type: 'int', required: true, min: 1, label: 'Quantity received' },
  cost_per_box: { type: 'decimal', required: true, min: 0, label: 'Cost per box' },
  batch_no: { type: 'string', required: true, max: 40, label: 'Batch number' },
  purchase_date: { type: 'date', required: true, label: 'Purchase date' },
};

// Inventory view: one row per product (fruit + box size) with stock health
exports.inventory = asyncHandler(async (req, res) => {
  const { fruit_id, box_size_id, province_id, status, search } = req.query;
  const where = ['p.is_active = 1'];
  const params = [];
  if (fruit_id) { where.push('p.fruit_id = ?'); params.push(Number(fruit_id)); }
  if (box_size_id) { where.push('p.box_size_id = ?'); params.push(Number(box_size_id)); }
  if (search) { where.push('(f.name LIKE ? OR p.sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (province_id) {
    where.push('EXISTS (SELECT 1 FROM purchases x JOIN suppliers sx ON sx.id = x.supplier_id WHERE x.product_id = p.id AND sx.province_id = ?)');
    params.push(Number(province_id));
  }
  const [rows] = await pool.query(
    `SELECT p.id, p.sku, f.name AS fruit, b.name AS box_size, b.weight_kg, p.selling_price, p.stock_quantity, p.reorder_threshold,
            CASE WHEN p.stock_quantity <= p.reorder_threshold THEN 'Critical'
                 WHEN p.stock_quantity <= p.reorder_threshold * 2 THEN 'Reorder Soon'
                 WHEN p.stock_quantity >= p.reorder_threshold * 6 THEN 'Surplus'
                 ELSE 'In Stock' END AS stock_status,
            (SELECT CONCAT(pu.batch_no, '|', pu.purchase_date) FROM purchases pu WHERE pu.product_id = p.id ORDER BY pu.purchase_date DESC, pu.id DESC LIMIT 1) AS last_consignment,
            (SELECT s.supplier_name FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id WHERE pu.product_id = p.id ORDER BY pu.purchase_date DESC, pu.id DESC LIMIT 1) AS key_supplier
     FROM products p JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id
     WHERE ${where.join(' AND ')} ORDER BY f.name, b.sort_order`, params);
  const filtered = status ? rows.filter((r) => r.stock_status === status) : rows;
  res.json(filtered.map((r) => {
    const [batch_no, purchase_date] = (r.last_consignment || '|').split('|');
    return { ...r, last_consignment: batch_no ? { batch_no, purchase_date } : null };
  }));
});

exports.purchases = asyncHandler(async (req, res) => {
  const { supplier_id, province_id, fruit_id } = req.query;
  const where = [];
  const params = [];
  if (supplier_id) { where.push('pu.supplier_id = ?'); params.push(Number(supplier_id)); }
  if (province_id) { where.push('s.province_id = ?'); params.push(Number(province_id)); }
  if (fruit_id) { where.push('p.fruit_id = ?'); params.push(Number(fruit_id)); }
  const [rows] = await pool.query(
    `SELECT pu.id, pu.supplier_id, s.supplier_name, pr.name AS province, p.id AS product_id, f.name AS fruit, b.name AS box_size,
            pu.quantity, pu.cost_per_box, ROUND(pu.quantity * pu.cost_per_box, 2) AS total_cost, pu.batch_no, pu.purchase_date
     FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id JOIN provinces pr ON pr.id = s.province_id
     JOIN products p ON p.id = pu.product_id JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY pu.purchase_date DESC, pu.id DESC LIMIT 200`, params);
  res.json(rows);
});

// Record incoming stock: inserts a purchase and increments products.stock_quantity atomically
exports.create = asyncHandler(async (req, res) => {
  const d = validateBody(req.body, purchaseRules);
  const id = await withTransaction(async (conn) => {
    const [[supplier]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [d.supplier_id]);
    if (!supplier) throw badRequest('Supplier does not exist');
    const [[product]] = await conn.query(
      'SELECT p.id, p.fruit_id, p.is_active, f.is_active AS fruit_active FROM products p JOIN fruits f ON f.id = p.fruit_id WHERE p.id = ? FOR UPDATE', [d.product_id]);
    if (!product) throw badRequest('Product does not exist');
    if (!product.is_active || !product.fruit_active) throw badRequest('This product is inactive');
    const [r] = await conn.query(
      'INSERT INTO purchases (supplier_id, product_id, quantity, cost_per_box, batch_no, purchase_date, created_by) VALUES (?,?,?,?,?,?,?)',
      [d.supplier_id, d.product_id, d.quantity, d.cost_per_box, d.batch_no, d.purchase_date, req.user.id]);
    await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [d.quantity, d.product_id]);
    // keep the supplier <-> fruit association up to date
    await conn.query('INSERT IGNORE INTO supplier_fruits (supplier_id, fruit_id) VALUES (?, ?)', [d.supplier_id, product.fruit_id]);
    return r.insertId;
  });
  const [[row]] = await pool.query('SELECT * FROM purchases WHERE id = ?', [id]);
  res.status(201).json(row);
});

// Correct a purchase record; stock is adjusted by the difference in quantity
exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = validateBody(req.body, {
    quantity: purchaseRules.quantity,
    cost_per_box: purchaseRules.cost_per_box,
    batch_no: purchaseRules.batch_no,
    purchase_date: purchaseRules.purchase_date,
  }, { partial: true });
  await withTransaction(async (conn) => {
    const [[old]] = await conn.query('SELECT * FROM purchases WHERE id = ? FOR UPDATE', [id]);
    if (!old) throw notFound('Purchase not found');
    const next = { ...old, ...d };
    const delta = next.quantity - old.quantity;
    if (delta !== 0) {
      const [[p]] = await conn.query('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE', [old.product_id]);
      if (p.stock_quantity + delta < 0) throw conflict('Reducing this purchase would make stock negative');
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [delta, old.product_id]);
    }
    await conn.query('UPDATE purchases SET quantity=?, cost_per_box=?, batch_no=?, purchase_date=? WHERE id=?',
      [next.quantity, next.cost_per_box, next.batch_no, next.purchase_date, id]);
  });
  const [[row]] = await pool.query('SELECT * FROM purchases WHERE id = ?', [id]);
  res.json(row);
});
