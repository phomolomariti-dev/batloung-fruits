const { pool } = require('../config/db');
const { asyncHandler } = require('../utils/errors');

// "Sales" always means COMPLETED orders. Cancelled/pending orders are never counted as sales.
const range = (q, col) => {
  const w = [];
  const p = [];
  if (q.from) { w.push(`${col} >= ?`); p.push(q.from); }
  if (q.to) { w.push(`${col} <= ?`); p.push(q.to); }
  return { w, p };
};

const reports = {
  'available-stock': async () => (await pool.query(
    `SELECT f.name AS fruit, b.name AS box_size, p.sku, p.stock_quantity, p.reorder_threshold, p.selling_price,
            ROUND(p.stock_quantity * p.selling_price, 2) AS stock_value
     FROM products p JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id
     WHERE p.is_active = 1 ORDER BY f.name, b.sort_order`))[0],

  'sales-by-fruit': async (q) => {
    const { w, p } = range(q, 'o.order_date');
    return (await pool.query(
      `SELECT f.name AS fruit, COALESCE(SUM(CASE WHEN o.id IS NULL THEN 0 ELSE oi.quantity END),0) AS boxes_sold,
              COALESCE(SUM(CASE WHEN o.id IS NULL THEN 0 ELSE oi.subtotal END),0) AS sales_value, COUNT(DISTINCT o.id) AS orders
       FROM fruits f LEFT JOIN products pr ON pr.fruit_id = f.id
       LEFT JOIN order_items oi ON oi.product_id = pr.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'Completed' ${w.length ? 'AND ' + w.join(' AND ') : ''}
       WHERE f.is_active = 1
       GROUP BY f.id ORDER BY sales_value DESC, f.name`, p))[0];
  },

  'sales-by-box-size': async (q) => {
    const { w, p } = range(q, 'o.order_date');
    return (await pool.query(
      `SELECT b.name AS box_size, COALESCE(SUM(CASE WHEN o.id IS NULL THEN 0 ELSE oi.quantity END),0) AS boxes_sold,
              COALESCE(SUM(CASE WHEN o.id IS NULL THEN 0 ELSE oi.subtotal END),0) AS sales_value
       FROM box_sizes b LEFT JOIN products pr ON pr.box_size_id = b.id
       LEFT JOIN order_items oi ON oi.product_id = pr.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'Completed' ${w.length ? 'AND ' + w.join(' AND ') : ''}
       GROUP BY b.id ORDER BY b.sort_order`, p))[0];
  },

  'sales-by-vendor': async (q) => {
    const { w, p } = range(q, 'o.order_date');
    return (await pool.query(
      `SELECT v.id AS vendor_id, v.vendor_name, v.business_name, v.location_area, COUNT(o.id) AS completed_orders, COALESCE(SUM(o.total_amount),0) AS sales_value
       FROM street_vendors v LEFT JOIN orders o ON o.vendor_id = v.id AND o.status = 'Completed' ${w.length ? 'AND ' + w.join(' AND ') : ''}
       GROUP BY v.id ORDER BY sales_value DESC, v.vendor_name`, p))[0];
  },

  'purchases-by-province': async (q) => {
    const { w, p } = range(q, 'pu.purchase_date');
    return (await pool.query(
      `SELECT pr.name AS province, COUNT(pu.id) AS purchases, COALESCE(SUM(pu.quantity),0) AS boxes_purchased,
              COALESCE(SUM(pu.quantity * pu.cost_per_box),0) AS purchase_value
       FROM provinces pr LEFT JOIN suppliers s ON s.province_id = pr.id
       LEFT JOIN purchases pu ON pu.supplier_id = s.id ${w.length ? 'AND ' + w.join(' AND ') : ''}
       GROUP BY pr.id ORDER BY purchase_value DESC, pr.name`, p))[0];
  },

  'pending-orders': async () => (await pool.query(
    `SELECT o.id, v.vendor_name, v.business_name, o.order_date, o.status, o.total_amount,
            (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS boxes
     FROM orders o JOIN street_vendors v ON v.id = o.vendor_id
     WHERE o.status IN ('Pending','Confirmed','Processing','Ready for Collection/Delivery') ORDER BY o.order_date, o.id`))[0],

  'completed-orders': async (q) => {
    const { w, p } = range(q, 'o.order_date');
    return (await pool.query(
      `SELECT o.id, v.vendor_name, v.business_name, o.order_date, o.completed_at, o.total_amount,
              (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS boxes
       FROM orders o JOIN street_vendors v ON v.id = o.vendor_id
       WHERE o.status = 'Completed' ${w.length ? 'AND ' + w.join(' AND ') : ''} ORDER BY o.order_date DESC, o.id DESC`, p))[0];
  },

  'sales-by-date': async (q) => {
    const { w, p } = range(q, 'o.order_date');
    return (await pool.query(
      `SELECT o.order_date AS date, COUNT(*) AS orders, SUM(o.total_amount) AS sales_value
       FROM orders o WHERE o.status = 'Completed' ${w.length ? 'AND ' + w.join(' AND ') : ''}
       GROUP BY o.order_date ORDER BY o.order_date DESC`, p))[0];
  },
};

exports.run = asyncHandler(async (req, res) => {
  const fn = reports[req.params.name];
  if (!fn) return res.status(404).json({ error: 'Unknown report', available: Object.keys(reports) });
  res.json({ report: req.params.name, generated_at: new Date().toISOString(), rows: await fn(req.query) });
});

exports.index = (_req, res) => res.json(Object.keys(reports));

exports.dashboard = asyncHandler(async (_req, res) => {
  const one = async (sql) => (await pool.query(sql))[0][0];
  const [fruits, suppliers, vendors, stock, orders, pending, completed, sales] = await Promise.all([
    one('SELECT COUNT(*) AS n FROM fruits WHERE is_active = 1'),
    one('SELECT COUNT(*) AS n FROM suppliers'),
    one("SELECT COUNT(*) AS n FROM street_vendors WHERE status = 'Active'"),
    one('SELECT COALESCE(SUM(stock_quantity),0) AS n FROM products WHERE is_active = 1'),
    one('SELECT COUNT(*) AS n FROM orders'),
    one("SELECT COUNT(*) AS n FROM orders WHERE status IN ('Pending','Confirmed','Processing','Ready for Collection/Delivery')"),
    one("SELECT COUNT(*) AS n FROM orders WHERE status = 'Completed'"),
    one("SELECT COALESCE(SUM(total_amount),0) AS n FROM orders WHERE status = 'Completed'"),
  ]);
  const [stockByFruit] = await pool.query(
    `SELECT f.name AS fruit, b.name AS box_size, p.stock_quantity, p.reorder_threshold
     FROM products p JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id
     WHERE p.is_active = 1 AND f.is_active = 1 ORDER BY f.name, b.sort_order`);
  const [byStatus] = await pool.query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
  const [salesByDate] = await pool.query(
    `SELECT order_date AS date, SUM(total_amount) AS sales_value FROM orders
     WHERE status = 'Completed' AND order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY order_date ORDER BY order_date`);
  const [provinces] = await pool.query(
    `SELECT pr.name AS province, COALESCE(SUM(pu.quantity * pu.cost_per_box),0) AS purchase_value
     FROM provinces pr LEFT JOIN suppliers s ON s.province_id = pr.id LEFT JOIN purchases pu ON pu.supplier_id = s.id
     GROUP BY pr.id ORDER BY purchase_value DESC, pr.name`);
  const [recent] = await pool.query(
    `SELECT o.id, v.vendor_name, v.business_name, o.order_date, o.status, o.total_amount
     FROM orders o JOIN street_vendors v ON v.id = o.vendor_id ORDER BY o.created_at DESC, o.id DESC LIMIT 6`);
  const [lowStock] = await pool.query(
    `SELECT f.name AS fruit, b.name AS box_size, p.stock_quantity, p.reorder_threshold
     FROM products p JOIN fruits f ON f.id = p.fruit_id JOIN box_sizes b ON b.id = p.box_size_id
     WHERE p.is_active = 1 AND p.stock_quantity <= p.reorder_threshold ORDER BY p.stock_quantity`);
  res.json({
    totals: {
      fruits: fruits.n, suppliers: suppliers.n, vendors: vendors.n, available_stock: Number(stock.n),
      orders: orders.n, pending_orders: pending.n, completed_orders: completed.n, sales_value: Number(sales.n),
    },
    stock_by_fruit: stockByFruit, orders_by_status: byStatus, sales_by_date: salesByDate,
    purchases_by_province: provinces, recent_orders: recent, low_stock: lowStock,
  });
});
