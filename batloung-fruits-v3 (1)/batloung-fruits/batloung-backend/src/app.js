require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set it.');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','), credentials: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' })); // Apple's form_post callback
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
