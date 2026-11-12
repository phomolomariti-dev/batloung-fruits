const { pool, withTransaction } = require('../config/db');
const { notFound, conflict, badRequest, asyncHandler } = require('../utils/errors');
const { validateBody, parseId } = require('../utils/validate');

const rules = {
  supplier_name: { type: 'string', required: true, max: 120, label: 'Supplier name' },
  province_id: { type: 'int', required: true, min: 1, label: 'Province' },
  contact_person: { type: 'string', required: true, max: 100, label: 'Contact person' },
  telephone: { type: 'phone', required: true, label: 'Telephone' },
  email: { type: 'email', required: true, max: 150, label: 'Email' },
  physical_address: { type: 'string', required: true, max: 255, label: 'Physical address' },
  fruit_ids: { type: 'intArray', label: 'Fruits supplied' },
};

const SELECT = `
  SELECT s.id, s.supplier_name, s.province_id, pr.name AS province, pr.code AS province_code,
         s.contact_person, s.telephone, s.email, s.physical_address,
         (SELECT GROUP_CONCAT(f.name ORDER BY f.name SEPARATOR ', ') FROM supplier_fruits sf JOIN fruits f ON f.id = sf.fruit_id WHERE sf.supplier_id = s.id) AS fruits_supplied,
         (SELECT COUNT(*) FROM purchases pu WHERE pu.supplier_id = s.id) AS consignments
  FROM suppliers s JOIN provinces pr ON pr.id = s.province_id`;

exports.list = asyncHandler(async (req, res) => {
  const { search, province_id } = req.query;
  const where = [];
  const params = [];
  if (province_id) { where.push('s.province_id = ?'); params.push(Number(province_id)); }
  if (search) {
    where.push('(s.supplier_name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ? OR pr.name LIKE ?)');
    params.push(...Array(4).fill(`%${search}%`));
  }
  const [rows] = await pool.query(`${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.supplier_name`, params);
  res.json(rows);
});

exports.get = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const [[row]] = await pool.query(`${SELECT} WHERE s.id = ?`, [id]);
  if (!row) throw notFound('Supplier not found');
  const [fr] = await pool.query('SELECT fruit_id FROM supplier_fruits WHERE supplier_id = ?', [id]);
  res.json({ ...row, fruit_ids: fr.map((x) => x.fruit_id) });
});

async function syncFruits(conn, supplierId, fruitIds) {
  await conn.query('DELETE FROM supplier_fruits WHERE supplier_id = ?', [supplierId]);
  for (const fid of fruitIds) await conn.query('INSERT INTO supplier_fruits (supplier_id, fruit_id) VALUES (?, ?)', [supplierId, fid]);
}

exports.create = asyncHandler(async (req, res) => {
  const d = validateBody(req.body, rules);
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO suppliers (supplier_name, province_id, contact_person, telephone, email, physical_address) VALUES (?,?,?,?,?,?)',
      [d.supplier_name, d.province_id, d.contact_person, d.telephone, d.email, d.physical_address]);
    if (d.fruit_ids) await syncFruits(conn, r.insertId, d.fruit_ids);
    return r.insertId;
  });
  const [[row]] = await pool.query(`${SELECT} WHERE s.id = ?`, [id]);
  res.status(201).json(row);
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = validateBody(req.body, rules);
  await withTransaction(async (conn) => {
    const [r] = await conn.query(
      'UPDATE suppliers SET supplier_name=?, province_id=?, contact_person=?, telephone=?, email=?, physical_address=? WHERE id=?',
      [d.supplier_name, d.province_id, d.contact_person, d.telephone, d.email, d.physical_address, id]);
    if (!r.affectedRows) {
      const [[exists]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [id]);
      if (!exists) throw notFound('Supplier not found');
    }
    if (d.fruit_ids) await syncFruits(conn, id, d.fruit_ids);
  });
  const [[row]] = await pool.query(`${SELECT} WHERE s.id = ?`, [id]);
  res.json(row);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const [[exists]] = await pool.query('SELECT id FROM suppliers WHERE id = ?', [id]);
  if (!exists) throw notFound('Supplier not found');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM purchases WHERE supplier_id = ?', [id]);
  if (n) throw conflict(`This supplier has ${n} recorded purchase(s) and cannot be deleted`);
  await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
  res.json({ message: 'Supplier deleted' });
});
