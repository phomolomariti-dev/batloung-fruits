const { pool, withTransaction } = require('../config/db');
const { notFound, conflict, badRequest, asyncHandler } = require('../utils/errors');
const { validateBody, parseId } = require('../utils/validate');

const rules = {
  name: { type: 'string', required: true, max: 60, label: 'Fruit name' },
  description: { type: 'string', max: 255, label: 'Description' },
  is_active: { type: 'enum', values: [0, 1, true, false], label: 'Status' },
};

exports.list = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const where = [];
  const params = [];
  if (search) { where.push('(f.name LIKE ? OR f.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (status === 'active') where.push('f.is_active = 1');
  if (status === 'inactive') where.push('f.is_active = 0');
  const [rows] = await pool.query(
    `SELECT f.id, f.name, f.description, f.is_active,
            COALESCE(SUM(p.stock_quantity), 0) AS total_stock, COUNT(p.id) AS product_count
     FROM fruits f LEFT JOIN products p ON p.fruit_id = f.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY f.id ORDER BY f.name`, params);
  res.json(rows);
});

exports.get = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const [[fruit]] = await pool.query('SELECT id, name, description, is_active FROM fruits WHERE id = ?', [id]);
  if (!fruit) throw notFound('Fruit not found');
  const [products] = await pool.query(
    `SELECT p.id, p.sku, b.name AS box_size, p.selling_price, p.stock_quantity
     FROM products p JOIN box_sizes b ON b.id = p.box_size_id WHERE p.fruit_id = ? ORDER BY b.sort_order`, [id]);
  res.json({ ...fruit, products });
});

// New fruits are added inactive: only the five specified fruits are sold initially,
// an administrator must explicitly activate any additional fruit.
exports.create = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, rules);
  const [r] = await pool.query('INSERT INTO fruits (name, description, is_active) VALUES (?, ?, 0)', [data.name, data.description || null]);
  res.status(201).json({ id: r.insertId, name: data.name, description: data.description || null, is_active: 0 });
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validateBody(req.body, rules, { partial: true });
  const sets = [];
  const params = [];
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active === true || data.is_active === 1 ? 1 : 0); }
  if (!sets.length) throw badRequest('Nothing to update');
  const [r] = await pool.query(`UPDATE fruits SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  if (!r.affectedRows) throw notFound('Fruit not found');
  const [[row]] = await pool.query('SELECT id, name, description, is_active FROM fruits WHERE id = ?', [id]);
  res.json(row);
});

// Fruits referenced by products/purchases are deactivated (soft delete); unused fruits are removed.
exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await withTransaction(async (conn) => {
    const [[fruit]] = await conn.query('SELECT id FROM fruits WHERE id = ? FOR UPDATE', [id]);
    if (!fruit) throw notFound('Fruit not found');
    const [[{ pending }]] = await conn.query(
      `SELECT COUNT(*) AS pending FROM order_items oi JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE p.fruit_id = ? AND o.status NOT IN ('Completed','Cancelled')`, [id]);
    if (pending) throw conflict('This fruit is on open orders. Complete or cancel them first.');
    const [[{ used }]] = await conn.query('SELECT COUNT(*) AS used FROM products WHERE fruit_id = ?', [id]);
    if (used) {
      await conn.query('UPDATE fruits SET is_active = 0 WHERE id = ?', [id]);
      await conn.query('UPDATE products SET is_active = 0 WHERE fruit_id = ?', [id]);
      return { deactivated: true };
    }
    await conn.query('DELETE FROM supplier_fruits WHERE fruit_id = ?', [id]);
    await conn.query('DELETE FROM fruits WHERE id = ?', [id]);
    return { deleted: true };
  });
  res.json({ message: result.deactivated ? 'Fruit deactivated' : 'Fruit deleted', ...result });
});
