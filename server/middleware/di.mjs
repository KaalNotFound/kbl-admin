/**
 * DI Middleware — Attaches the DI container to every request.
 *
 * Usage:
 *   import { createDiMiddleware } from './middleware/di.mjs';
 *   app.use(createDiMiddleware(container));
 *
 * Then in routes:
 *   const { useCases, logger } = req.container;
 */
export function createDiMiddleware(container) {
  return function diMiddleware(req, _res, next) {
    req.container = container;
    // Shorthand for routes that only need use cases
    req.useCases = container.useCases;
    // Shorthand for logging with correlationId
    req.log = container.logger;
    next();
  };
}
