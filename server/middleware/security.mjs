/**
 * Security Middleware — Helmet, CORS, Rate Limit, API Key auth, demo mode.
 * Extracted from server/index.js for SRP compliance.
 *
 * Perimeter rules (issue KaalNotFound/kbl-admin#3):
 * - Fail closed on public binds without a key (assertSafeBind).
 * - Rate limit BEFORE auth so 401 floods are throttled.
 * - Constant-time API key comparison, header only (no query param).
 * - Same-origin CORS by default, CSP enabled.
 */
import crypto from 'node:crypto';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { throttledErrorLog } from '../lib/error-handler.mjs';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

/** Constant-time string comparison guarded by an explicit length check. */
function timingSafeEqualStrings(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Refuse to expose the API on a non-loopback host unless it is protected by an
 * API key or explicitly running in read-only demo mode.
 */
export function assertSafeBind({ host, apiKey = '', demoMode = false } = {}) {
  if (demoMode || apiKey) return;
  if (LOOPBACK_HOSTS.has(String(host).toLowerCase())) return;
  throw new Error(
    `Bind público bloqueado: HOST="${host}" sin API_KEY. ` +
      'Configurá API_KEY, activá KBL_DEMO=1 o bindeá a 127.0.0.1.',
  );
}

/**
 * Demo mode: a public read-only demo. GET/HEAD/OPTIONS pass through; any
 * mutating method under /api is rejected with 403.
 */
export function createDemoModeMiddleware({ demoMode = process.env.KBL_DEMO === '1' } = {}) {
  return (req, res, next) => {
    if (!demoMode) return next();
    const underApi = req.path === '/api' || req.path.startsWith('/api/');
    if (!underApi) return next();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    return res.status(403).json({ error: 'Demo pública: modo solo lectura.' });
  };
}

/**
 * Per-route rate limiter for expensive endpoints (LLM proxies, vault scans).
 * Same wire behavior as the global limiter (standard headers, JSON 429) but
 * with a tighter per-route quota and a caller-provided Spanish message.
 */
export function createScopedRateLimiter({
  windowMs = 60 * 1000,
  max = 10,
  message = 'Demasiadas solicitudes a este endpoint. Intentá de nuevo en un instante.',
} = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

const DEFAULT_CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
};

export function createSecurityMiddleware(opts = {}) {
  const {
    apiKey = process.env.API_KEY || '',
    rateLimitWindowMs = 60 * 1000,
    rateLimitMax = 500,
    cspDirectives = {},
  } = opts;
  const corsOrigins = opts.corsOrigins ?? process.env.CORS_ORIGINS ?? '';

  const middlewares = [];

  // Helmet with an explicit CSP (defaults merged, caller can override).
  middlewares.push(
    helmet({
      contentSecurityPolicy: {
        directives: { ...DEFAULT_CSP_DIRECTIVES, ...cspDirectives },
      },
    }),
  );

  // CORS: same-origin by default; only configured origins are echoed.
  const origins =
    corsOrigins === '*'
      ? '*'
      : corsOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  middlewares.push(cors({ origin: origins.length ? origins : false }));

  // Rate limit BEFORE auth so repeated 401s are throttled too.
  middlewares.push(
    rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // API Key auth (only if key is set). Constant-time, header only.
  if (apiKey) {
    middlewares.push((req, res, next) => {
      const provided = req.headers['x-api-key'];
      if (typeof provided === 'string' && timingSafeEqualStrings(provided, apiKey)) {
        return next();
      }
      // Never log the provided key, only the rejection.
      throttledErrorLog('security', req.method, req.path, new Error('API key inválida o ausente'));
      return res.status(401).json({ error: 'API key requerida. Usá header X-Api-Key.' });
    });
  }

  return middlewares;
}
