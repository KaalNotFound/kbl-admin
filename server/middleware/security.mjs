/**
 * Security Middleware — Helmet, CORS, Rate Limit, API Key auth.
 * Extracted from server/index.js for SRP compliance.
 */
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

export function createSecurityMiddleware(opts = {}) {
  const {
    corsOrigins = process.env.CORS_ORIGINS || '*',
    apiKey = process.env.API_KEY || '',
    rateLimitWindowMs = 60 * 1000,
    rateLimitMax = 500,
  } = opts;

  const middlewares = [];

  // Helmet (CSP disabled for SPA)
  middlewares.push(helmet({ contentSecurityPolicy: false }));

  // CORS
  const origins = corsOrigins === '*' ? '*' : corsOrigins.split(',').map(s => s.trim());
  middlewares.push(cors({ origin: origins }));

  // API Key auth (only if key is set)
  if (apiKey) {
    middlewares.push((req, res, next) => {
      const provided = req.headers['x-api-key'] || req.query.api_key;
      if (provided === apiKey) return next();
      return res.status(401).json({ error: 'API key requerida. Usá header X-Api-Key.' });
    });
  }

  // Rate limiting
  middlewares.push(rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  return middlewares;
}
