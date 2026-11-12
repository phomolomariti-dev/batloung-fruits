const { pool } = require('../config/db');
const { notFound, conflict, badRequest, asyncHandler } = require('../utils/errors');
const { validateBody, parseId } = require('../utils/validate');

const BASE = `SELECT p.id, p.sku, p.fruit_id, f.name AS fruit, p.box_size_id, b.name AS box_size, b.weight_kg,
                     p.selling_price, p.stock_quantity, p.reorder_threshold, p.is_active
              FROM products p JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id`;

exports.list = asyncHandler(async (req, res) => {
  const { fruit_id, box_size_id, search, active } = req.query;
  const where = [];
  const params = [];
  if (fruit_id) { where.push('p.fruit_id = ?'); params.push(Number(fruit_id)); }
  if (box_size_id) { where.push('p.box_size_id = ?'); params.push(Number(box_size_id)); }
  if (search) { where.push('(f.name LIKE ? OR p.sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (active === '1') where.push('p.is_active = 1 AND f.is_active = 1');
  const [rows] = await pool.query(`${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY f.name, b.sort_order`, params);
  res.json(rows);
});

// Every product MUST have a fruit, a box size and a selling price
exports.create = asyncHandler(async (req, res) => {
  const d = validateBody(req.body, {
    fruit_id: { type: 'int', required: true, min: 1, label: 'Fruit' },
    box_size_id: { type: 'int', required: true, min: 1, label: 'Box size' },
    selling_price: { type: 'decimal', required: true, exclusiveMin: 0, label: 'Selling price' },
    reorder_threshold: { type: 'int', min: 0, label: 'Reorder threshold' },
  });
  const [[fruit]] = await pool.query('SELECT name FROM fruits WHERE id = ?', [d.fruit_id]);
  const [[box]] = await pool.query('SELECT name FROM box_sizes WHERE id = ?', [d.box_size_id]);
  if (!fruit) throw badRequest('Fruit does not exist');
  if (!box) throw badRequest('Box size does not exist');
  const [[dup]] = await pool.query('SELECT id FROM products WHERE fruit_id = ? AND box_size_id = ?', [d.fruit_id, d.box_size_id]);
  if (dup) throw conflict(`${fruit.name} (${box.name}) already exists as a product`);
  const sku = `SKU-${fruit.name.slice(0, 3).toUpperCase()}-${box.name.slice(0, 3).toUpperCase()}`;
  const [r] = await pool.query(
    'INSERT INTO products (fruit_id, box_size_id, sku, selling_price, reorder_threshold) VALUES (?, ?, ?, ?, ?)',
    [d.fruit_id, d.box_size_id, sku, d.selling_price, d.reorder_threshold ?? 50]);
  const [[row]] = await pool.query(`${BASE} WHERE p.id = ?`, [r.insertId]);
  res.status(201).json(row);
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = validateBody(req.body, {
    selling_price: { type: 'decimal', exclusiveMin: 0, label: 'Selling price' },
    reorder_threshold: { type: 'int', min: 0, label: 'Reorder threshold' },
    is_active: { type: 'enum', values: [0, 1, true, false], label: 'Status' },
  }, { partial: true });
  const sets = [];
  const params = [];
  if (d.selling_price !== undefined) { sets.push('selling_price = ?'); params.push(d.selling_price); }
  if (d.reorder_threshold !== undefined) { sets.push('reorder_threshold = ?'); params.push(d.reorder_threshold); }
  if (d.is_active !== undefined) { sets.push('is_active = ?'); params.push(d.is_active === true || d.is_active === 1 ? 1 : 0); }
  if (!sets.length) throw badRequest('Nothing to update');
  const [r] = await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  if (!r.affectedRows) throw notFound('Product not found');
  const [[row]] = await pool.query(`${BASE} WHERE p.id = ?`, [id]);
  res.json(row);
});
