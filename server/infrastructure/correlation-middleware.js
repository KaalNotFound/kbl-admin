/**
 * correlationIdMiddleware — Express middleware that assigns a correlationId to every request.
 *
 * Behavior:
 *   1. If request has `X-Correlation-Id` header → use it (propagation)
 *   2. Otherwise → generate a new one (crypto.randomUUID)
 *   3. Attach to `req.correlationId` for downstream use
 *   4. Set response header `X-Correlation-Id` for traceability
 *   5. Attach a child StructuredLogger to `req.log`
 *
 * Usage:
 *   import { correlationIdMiddleware, requestLogger } from './infrastructure/correlation-middleware.js';
 *   app.use(correlationIdMiddleware);
 *   app.use(requestLogger);
 */

import crypto from 'crypto';
import { StructuredLogger } from './structured-logger.js';

/**
 * Middleware: assigns correlationId + creates req.log
 */
function correlationIdMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  // Create request-scoped logger
  req.log = new StructuredLogger({
    service: 'kbl-admin',
    correlationId,
    minLevel: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
    console: process.env.NODE_ENV !== 'production',
  });

  next();
}

/**
 * Middleware: logs request start and finish with timing.
 */
function requestLogger(req, res, next) {
  const start = performance.now();
  const { method, originalUrl } = req;

  req.log.info('request.start', { method, url: originalUrl, ip: req.ip });

  // Hook into response finish
  const originalEnd = res.end;
  res.end = function (...args) {
    const elapsed = Math.round((performance.now() - start) * 100) / 100;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    req.log[level]('request.end', {
      method,
      url: originalUrl,
      statusCode: res.statusCode,
      durationMs: elapsed,
    });

    originalEnd.apply(this, args);
  };

  next();
}

export { correlationIdMiddleware, requestLogger };
