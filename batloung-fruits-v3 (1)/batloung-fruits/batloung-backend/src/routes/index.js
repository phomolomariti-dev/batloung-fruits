const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');

const auth = require('../controllers/auth.controller');
const oauth = require('../controllers/oauth.controller');
const users = require('../controllers/users.controller');
const lookups = require('../controllers/lookups.controller');
const fruits = require('../controllers/fruits.controller');
const products = require('../controllers/products.controller');
const suppliers = require('../controllers/suppliers.controller');
const stock = require('../controllers/stock.controller');
const vendors = require('../controllers/vendors.controller');
const orders = require('../controllers/orders.controller');
const reports = require('../controllers/reports.controller');
const { pool } = require('../config/db');

const router = express.Router();
const ADMIN = authorize('administrator');
const ANY = authorize('administrator', 'sales');

// --- Public ---------------------------------------------------------------
router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.get('/health/database', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error);
    return res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});
router.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts, try again later' } }), auth.login);

// Self-service account creation (Sales for anyone, Administrator only with the access code)
router.get('/auth/signup-options', auth.signupOptions);
router.post('/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-up attempts, try again later' } }), auth.register);

// Social sign-in (every provider is optional and only works once its keys are configured)
router.get('/auth/providers', oauth.providers);
router.get('/auth/oauth/:provider/start', oauth.start);
router.get('/auth/oauth/:provider/callback', oauth.callback);
router.post('/auth/oauth/:provider/callback', oauth.callback); // Apple posts its response (form_post)

// --- Everything below requires a valid JWT ------------------------------
router.use(authenticate);
router.get('/auth/me', auth.me);
router.get('/dashboard', ANY, reports.dashboard);

// Users and access (administrator only)
router.get('/users', ADMIN, users.list);
router.put('/users/:id', ADMIN, users.update);

// Reference data
router.get('/provinces', ANY, lookups.listProvinces);
router.get('/box-sizes', ANY, lookups.listBoxSizes);
router.put('/box-sizes/:id', ADMIN, lookups.updateBoxSize);

// Fruits (admin manages; sales can read)
router.get('/fruits', ANY, fruits.list);
router.get('/fruits/:id', ANY, fruits.get);
router.post('/fruits', ADMIN, fruits.create);
router.put('/fruits/:id', ADMIN, fruits.update);
router.delete('/fruits/:id', ADMIN, fruits.remove);

// Products = fruit + box size (sales can view)
router.get('/products', ANY, products.list);
router.post('/products', ADMIN, products.create);
router.put('/products/:id', ADMIN, products.update);

// Suppliers (admin only)
router.get('/suppliers', ADMIN, suppliers.list);
router.get('/suppliers/:id', ADMIN, suppliers.get);
router.post('/suppliers', ADMIN, suppliers.create);
router.put('/suppliers/:id', ADMIN, suppliers.update);
router.delete('/suppliers/:id', ADMIN, suppliers.remove);

// Stock & purchases (admin only)
router.get('/stock', ADMIN, stock.inventory);
router.get('/stock/purchases', ADMIN, stock.purchases);
router.post('/stock', ADMIN, stock.create);
router.put('/stock/:id', ADMIN, stock.update);

// Street vendors (sales can view + register; admin can edit/delete)
router.get('/vendors', ANY, vendors.list);
router.get('/vendors/geocode/reverse', ANY, vendors.reverseGeocode);
router.get('/vendors/geocode', ANY, vendors.geocode);
router.get('/vendors/:id', ANY, vendors.get);
router.post('/vendors', ANY, vendors.create);
router.put('/vendors/:id', ADMIN, vendors.update);
router.delete('/vendors/:id', ADMIN, vendors.remove);

// Orders (sales can create/view/update status; admin can also edit items + delete)
router.get('/orders', ANY, orders.list);
router.get('/orders/:id', ANY, orders.get);
router.post('/orders', ANY, orders.create);
router.put('/orders/:id', ANY, orders.update);
router.delete('/orders/:id', ADMIN, orders.remove);

// Reports (admin only)
router.get('/reports', ADMIN, reports.index);
router.get('/reports/:name', ADMIN, reports.run);

module.exports = router;
