const { pool } = require('../config/db');
const { HttpError, badRequest, notFound, conflict, asyncHandler } = require('../utils/errors');
const { validateBody, parseId } = require('../utils/validate');

let geocodeQueue = Promise.resolve();
let geocodeLastRequestedAt = 0;

const rules = {
  vendor_name: { type: 'string', required: true, max: 100, label: 'Vendor name' },
  business_name: { type: 'string', required: true, max: 120, label: 'Business name' },
  telephone: { type: 'phone', required: true, label: 'Telephone' },
  location_area: { type: 'string', required: true, max: 100, label: 'Location / area in Maseru' },
  latitude: { type: 'coordinate', required: true, min: -90, max: 90, label: 'Latitude' },
  longitude: { type: 'coordinate', required: true, min: -180, max: 180, label: 'Longitude' },
  registration_date: { type: 'date', label: 'Registration date' },
  status: { type: 'enum', values: ['Active', 'Inactive'], label: 'Status' },
};

const SELECT = `SELECT v.id, v.vendor_name, v.business_name, v.telephone, v.location_area, v.latitude, v.longitude, v.registration_date, v.status,
  (SELECT COUNT(*) FROM orders o WHERE o.vendor_id = v.id) AS order_count,
  (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.vendor_id = v.id AND o.status = 'Completed') AS total_sales
  FROM street_vendors v`;

exports.geocode = asyncHandler(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 100) throw badRequest('Enter a location of at most 100 characters');

  const lookup = geocodeQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - geocodeLastRequestedAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    geocodeLastRequestedAt = Date.now();

    const params = new URLSearchParams({ q: `${query}, Lesotho`, format: 'jsonv2', limit: '5', countrycodes: 'ls' });
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'BatloungFruitsVendorLocator/1.0', 'Accept-Language': 'en' },
      });
      if (!response.ok) throw new HttpError(502, `Map search service returned ${response.status}`);
      return response.json();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'Could not search the map right now. You can still select a point manually.');
    }
  });
  geocodeQueue = lookup.then(() => undefined, () => undefined);
  res.json(await lookup);
});

exports.reverseGeocode = asyncHandler(async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw badRequest('Latitude must be between -90 and 90');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw badRequest('Longitude must be between -180 and 180');

  const lookup = geocodeQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - geocodeLastRequestedAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    geocodeLastRequestedAt = Date.now();

    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      zoom: '18',
      addressdetails: '1',
    });
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { 'User-Agent': 'BatloungFruitsVendorLocator/1.0', 'Accept-Language': 'en' },
      });
      if (!response.ok) throw new HttpError(502, `Map search service returned ${response.status}`);
      return response.json();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'Could not identify this map location right now.');
    }
  });
  geocodeQueue = lookup.then(() => undefined, () => undefined);
  res.json(await lookup);
});

exports.list = asyncHandler(async (req, res) => {
  const { search, status, location } = req.query;
  const where = [];
  const params = [];
  if (status) { where.push('v.status = ?'); params.push(status); }
  if (location) { where.push('v.location_area = ?'); params.push(location); }
  if (search) {
    where.push('(v.vendor_name LIKE ? OR v.business_name LIKE ? OR v.telephone LIKE ? OR v.location_area LIKE ? OR CAST(v.id AS CHAR) = ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, search);
  }
  const [rows] = await pool.query(`${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY v.vendor_name`, params);
  res.json(rows);
});

exports.get = asyncHandler(async (req, res) => {
  const [[row]] = await pool.query(`${SELECT} WHERE v.id = ?`, [parseId(req.params.id)]);
  if (!row) throw notFound('Vendor not found');
  res.json(row);
});

exports.create = asyncHandler(async (req, res) => {
  const d = validateBody(req.body, rules);
  const date = d.registration_date || new Date().toISOString().slice(0, 10);
  // Sales users may register vendors but always as Active
  const status = req.user.role === 'administrator' && d.status ? d.status : 'Active';
  const [r] = await pool.query(
    'INSERT INTO street_vendors (vendor_name, business_name, telephone, location_area, latitude, longitude, registration_date, status) VALUES (?,?,?,?,?,?,?,?)',
    [d.vendor_name, d.business_name, d.telephone, d.location_area, d.latitude, d.longitude, date, status]);
  const [[row]] = await pool.query(`${SELECT} WHERE v.id = ?`, [r.insertId]);
  res.status(201).json(row);
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = validateBody(req.body, rules);
  const [r] = await pool.query(
    `UPDATE street_vendors SET vendor_name=?, business_name=?, telephone=?, location_area=?,
       latitude=?, longitude=?, registration_date=COALESCE(?, registration_date), status=COALESCE(?, status) WHERE id=?`,
    [d.vendor_name, d.business_name, d.telephone, d.location_area, d.latitude, d.longitude, d.registration_date || null, d.status || null, id]);
  if (!r.affectedRows) {
    const [[exists]] = await pool.query('SELECT id FROM street_vendors WHERE id = ?', [id]);
    if (!exists) throw notFound('Vendor not found');
  }
  const [[row]] = await pool.query(`${SELECT} WHERE v.id = ?`, [id]);
  res.json(row);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const [[exists]] = await pool.query('SELECT id FROM street_vendors WHERE id = ?', [id]);
  if (!exists) throw notFound('Vendor not found');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM orders WHERE vendor_id = ?', [id]);
  if (n) throw conflict('This vendor has orders and cannot be deleted. Set the vendor to Inactive instead.');
  await pool.query('DELETE FROM street_vendors WHERE id = ?', [id]);
  res.json({ message: 'Vendor deleted' });
});
