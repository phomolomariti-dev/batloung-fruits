const { pool } = require('../config/db');
const { HttpError, notFound, badRequest, asyncHandler } = require('../utils/errors');
const { validateBody, parseId } = require('../utils/validate');

const SELECT = `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.terms_version, u.terms_accepted_at, u.created_at,
  (SELECT GROUP_CONCAT(i.provider ORDER BY i.provider SEPARATOR ',') FROM user_identities i WHERE i.user_id = u.id) AS providers
  FROM users u`; // never selects password_hash

exports.list = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`${SELECT} ORDER BY u.created_at DESC, u.id DESC`);
  res.json(rows.map((r) => ({ ...r, providers: r.providers ? r.providers.split(',') : [] })));
});

// Change someone's role, or switch their account on or off. Takes effect on their next request.
exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = validateBody(req.body, {
    role: { type: 'enum', values: ['administrator', 'sales'], label: 'Role' },
    is_active: { type: 'enum', values: [0, 1, true, false], label: 'Status' },
  }, { partial: true });
  if (d.role === undefined && d.is_active === undefined) throw badRequest('Provide a role and/or status to change');
  // An administrator cannot lock themselves out, so there is always at least one active administrator
  if (id === req.user.id) throw new HttpError(409, 'You cannot change your own role or status. Ask another administrator.');
  const sets = []; const params = [];
  if (d.role !== undefined) { sets.push('role = ?'); params.push(d.role); }
  if (d.is_active !== undefined) { sets.push('is_active = ?'); params.push(d.is_active === true || d.is_active === 1 ? 1 : 0); }
  const [r] = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  if (!r.affectedRows) throw notFound('User not found');
  const [[row]] = await pool.query(`${SELECT} WHERE u.id = ?`, [id]);
  res.json({ ...row, providers: row.providers ? row.providers.split(',') : [] });
});
