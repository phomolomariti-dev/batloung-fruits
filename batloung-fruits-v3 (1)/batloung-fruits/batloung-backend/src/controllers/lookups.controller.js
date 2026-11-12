const { pool } = require('../config/db');
const { notFound, asyncHandler } = require('../utils/errors');
const { validateBody, parseId } = require('../utils/validate');

exports.listProvinces = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, code FROM provinces ORDER BY name');
  res.json(rows);
});

exports.listBoxSizes = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, weight_kg, sort_order FROM box_sizes ORDER BY sort_order');
  res.json(rows);
});

// Box sizes are fixed (Small/Medium/Large); admins can adjust the weight specification
exports.updateBoxSize = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const data = validateBody(req.body, { weight_kg: { type: 'decimal', required: true, exclusiveMin: 0, label: 'Weight (kg)' } });
  const [r] = await pool.query('UPDATE box_sizes SET weight_kg = ? WHERE id = ?', [data.weight_kg, id]);
  if (!r.affectedRows) throw notFound('Box size not found');
  const [[row]] = await pool.query('SELECT id, name, weight_kg, sort_order FROM box_sizes WHERE id = ?', [id]);
  res.json(row);
});
