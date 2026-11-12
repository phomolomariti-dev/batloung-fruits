const { pool, withTransaction } = require('../config/db');
const { HttpError, notFound, conflict, badRequest, asyncHandler } = require('../utils/errors');
const { parseId } = require('../utils/validate');

const STATUSES = ['Pending', 'Confirmed', 'Processing', 'Ready for Collection/Delivery', 'Completed', 'Cancelled'];
// Statuses a Sales user may set. Completing an order (which reduces stock) is an administrator action.
const SALES_ALLOWED = ['Confirmed', 'Processing', 'Ready for Collection/Delivery', 'Cancelled'];
const FINAL = ['Completed', 'Cancelled'];

const round2 = (n) => Math.round(n * 100) / 100;

/** Validate the raw items array and merge duplicate products. Rules: >= 1 item, quantity > 0 (whole number). */
function normaliseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('An order must contain at least one item');
  const merged = new Map();
  const errors = {};
  items.forEach((it, i) => {
    const pid = Number(it && it.product_id);
    const qty = Number(it && it.quantity);
    if (!Number.isInteger(pid) || pid <= 0) errors[`items[${i}].product_id`] = 'Select a product (fruit and box size)';
    else if (!Number.isInteger(qty) || qty <= 0) errors[`items[${i}].quantity`] = 'Quantity must be a whole number greater than zero';
    else merged.set(pid, (merged.get(pid) || 0) + qty);
  });
  if (Object.keys(errors).length) throw badRequest('Validation failed', errors);
  return [...merged].map(([product_id, quantity]) => ({ product_id, quantity }));
}

/** Lock products, check stock availability, snapshot unit prices and compute subtotals/total. */
async function priceItems(conn, items) {
  const priced = [];
  for (const it of items) {
    const [[p]] = await conn.query(
      `SELECT p.id, p.selling_price, p.stock_quantity, p.is_active, f.name AS fruit, f.is_active AS fruit_active, b.name AS box_size
       FROM products p JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id WHERE p.id = ? FOR UPDATE`, [it.product_id]);
    if (!p) throw badRequest(`Product ${it.product_id} does not exist`);
    if (!p.is_active || !p.fruit_active) throw badRequest(`${p.fruit} (${p.box_size}) is not available for sale`);
    if (it.quantity > p.stock_quantity) {
      throw conflict(`Insufficient stock for ${p.fruit} (${p.box_size}): requested ${it.quantity}, available ${p.stock_quantity}`);
    }
    priced.push({ product_id: p.id, quantity: it.quantity, unit_price: p.selling_price, subtotal: round2(it.quantity * p.selling_price) });
  }
  const total = round2(priced.reduce((s, x) => s + x.subtotal, 0));
  return { priced, total };
}

async function writeItems(conn, orderId, priced) {
  await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  for (const x of priced) {
    await conn.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?)',
      [orderId, x.product_id, x.quantity, x.unit_price, x.subtotal]);
  }
}

const ORDER_SELECT = `
  SELECT o.id, o.vendor_id, v.vendor_name, v.business_name, o.order_date, o.status, o.total_amount, o.completed_at,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
         (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS box_count
  FROM orders o JOIN street_vendors v ON v.id = o.vendor_id`;

async function loadOrder(id, db = pool) {
  const [[order]] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  if (!order) return null;
  const [items] = await db.query(
    `SELECT oi.id, oi.product_id, f.name AS fruit, b.name AS box_size, p.sku, oi.quantity, oi.unit_price, oi.subtotal
     FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id
     WHERE oi.order_id = ? ORDER BY oi.id`, [id]);
  return { ...order, items };
}

exports.list = asyncHandler(async (req, res) => {
  const { status, vendor_id, fruit_id, box_size_id, search, date_from, date_to } = req.query;
  const where = [];
  const params = [];
  if (status) {
    if (!STATUSES.includes(status)) throw badRequest('Unknown order status');
    where.push('o.status = ?'); params.push(status);
  }
  if (vendor_id) { where.push('o.vendor_id = ?'); params.push(Number(vendor_id)); }
  if (date_from) { where.push('o.order_date >= ?'); params.push(date_from); }
  if (date_to) { where.push('o.order_date <= ?'); params.push(date_to); }
  if (fruit_id) {
    where.push('EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id AND p.fruit_id = ?)');
    params.push(Number(fruit_id));
  }
  if (box_size_id) {
    where.push('EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id AND p.box_size_id = ?)');
    params.push(Number(box_size_id));
  }
  if (search) {
    where.push('(v.vendor_name LIKE ? OR v.business_name LIKE ? OR CAST(o.id AS CHAR) = ?)');
    params.push(`%${search}%`, `%${search}%`, String(search).replace(/^#?ORD-?0*/i, ''));
  }
  const [rows] = await pool.query(`${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.order_date DESC, o.id DESC LIMIT 500`, params);
  res.json(rows);
});

exports.get = asyncHandler(async (req, res) => {
  const order = await loadOrder(parseId(req.params.id));
  if (!order) throw notFound('Order not found');
  res.json(order);
});

exports.create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const vendorId = Number(body.vendor_id);
  if (!Number.isInteger(vendorId) || vendorId <= 0) throw badRequest('An order must belong to a registered street vendor', { vendor_id: 'Select a vendor' });
  const items = normaliseItems(body.items);
  const orderDate = body.order_date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate) || Number.isNaN(Date.parse(orderDate))) throw badRequest('Order date must be a valid date', { order_date: 'Invalid date' });

  const id = await withTransaction(async (conn) => {
    const [[vendor]] = await conn.query('SELECT id, status FROM street_vendors WHERE id = ?', [vendorId]);
    if (!vendor) throw badRequest('Vendor is not registered');
    if (vendor.status !== 'Active') throw badRequest('Vendor is inactive and cannot place orders');
    const { priced, total } = await priceItems(conn, items);
    const [r] = await conn.query('INSERT INTO orders (vendor_id, order_date, status, total_amount, created_by) VALUES (?,?,?,?,?)',
      [vendorId, orderDate, 'Pending', total, req.user.id]);
    await writeItems(conn, r.insertId, priced);
    return r.insertId;
  });
  res.status(201).json(await loadOrder(id));
});

/**
 * PUT /api/orders/:id  { status?, items? }
 *  - status: forward-only progression, Cancelled from any non-final state.
 *      Completed  -> re-checks stock and DECREASES products.stock_quantity (inside a transaction)
 *      Cancelled  -> never touches stock
 *  - items (administrator, Pending orders only): replaces the order lines and recalculates totals.
 */
exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, items } = req.body || {};
  if (status === undefined && items === undefined) throw badRequest('Provide a status and/or items to update');
  if (status !== undefined && !STATUSES.includes(status)) throw badRequest('Unknown order status', { status: `Must be one of: ${STATUSES.join(', ')}` });
  if (items !== undefined && req.user.role !== 'administrator') throw new HttpError(403, 'Only an administrator can edit order items');
  if (status !== undefined && req.user.role === 'sales' && !SALES_ALLOWED.includes(status)) {
    throw new HttpError(403, `Sales users cannot set status "${status}"`);
  }

  await withTransaction(async (conn) => {
    const [[order]] = await conn.query('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!order) throw notFound('Order not found');
    if (FINAL.includes(order.status)) throw conflict(`A ${order.status.toLowerCase()} order can no longer be changed`);

    if (items !== undefined) {
      if (order.status !== 'Pending') throw conflict('Items can only be edited while the order is Pending');
      const { priced, total } = await priceItems(conn, normaliseItems(items));
      await writeItems(conn, id, priced);
      await conn.query('UPDATE orders SET total_amount = ? WHERE id = ?', [total, id]);
    }

    if (status !== undefined && status !== order.status) {
      const from = STATUSES.indexOf(order.status);
      const to = STATUSES.indexOf(status);
      if (status !== 'Cancelled' && to < from) throw conflict(`Cannot move an order back from ${order.status} to ${status}`);

      if (status === 'Completed') {
        const [lines] = await conn.query(
          `SELECT oi.product_id, oi.quantity, p.stock_quantity, f.name AS fruit, b.name AS box_size
           FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id
           WHERE oi.order_id = ? ORDER BY oi.product_id FOR UPDATE`, [id]);
        for (const l of lines) {
          if (l.quantity > l.stock_quantity) throw conflict(`Cannot complete: only ${l.stock_quantity} boxes of ${l.fruit} (${l.box_size}) in stock, order needs ${l.quantity}`);
        }
        for (const l of lines) await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [l.quantity, l.product_id]);
        await conn.query('UPDATE orders SET status = ?, completed_at = NOW() WHERE id = ?', [status, id]);
      } else {
        await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]); // Cancelled: stock untouched
      }
    }
  });
  res.json(await loadOrder(id));
});

exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const [[order]] = await pool.query('SELECT status FROM orders WHERE id = ?', [id]);
  if (!order) throw notFound('Order not found');
  if (order.status === 'Completed') throw conflict('Completed orders are part of the sales record and cannot be deleted');
  await pool.query('DELETE FROM orders WHERE id = ?', [id]);
  res.json({ message: 'Order deleted' });
});

exports.STATUSES = STATUSES;
