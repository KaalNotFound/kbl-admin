/**
 * KBL Admin — Server Entry Point.
 * Slim orchestrator: app → security → DI → routes → error → listen.
 */
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Process-level safety net ---
// A CDP/puppeteer session attached to a real browser can fire rejections
// outside any request scope (target closed mid-evaluation, WebSocket drop,
// disconnect events). Without handlers those kill the whole Node process,
// taking the API down on a single UI click. Log loudly and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason instanceof Error ? (reason.stack || reason.message) : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err?.stack || err);
  if (shouldExitOnUncaught(process.env)) {
    // Supervised runs (KBL_EXIT_ON_UNCAUGHT=1): crash loudly so the
    // supervisor restarts with clean state instead of serving from
    // unknowable in-memory state.
    process.exit(1);
  }
  // Default: keep serving. Killing a local dashboard on a benign bug is
  // worse UX than a degraded process; the error above is the evidence.
});

// Infrastructure
import { createContainer } from './di-container.js';
import { createDiMiddleware } from './middleware/di.mjs';
import { correlationIdMiddleware, requestLogger } from './infrastructure/correlation-middleware.js';
import { shouldExitOnUncaught } from './lib/crash-policy.mjs';

// Security + Routes
import {
  createSecurityMiddleware,
  createDemoModeMiddleware,
  assertSafeBind,
} from './middleware/security.mjs';
import { apiRouters } from './routes/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEMO_MODE = process.env.KBL_DEMO === '1';

// --- Security ---
app.use(...createSecurityMiddleware());

// --- Body parsing ---
app.use(express.json({ limit: '1mb' }));

// --- Demo read-only mode (public demo): block writes under /api ---
app.use(createDemoModeMiddleware({ demoMode: DEMO_MODE }));

// --- DI + Observability ---
const container = createContainer({
  vaultRoot: path.resolve(__dirname, '..', '..'),
});
app.use(correlationIdMiddleware);
app.use(createDiMiddleware(container));

// --- Request lifecycle logging ---
// Mounted BEFORE API routers: it wraps res.end so matched route handlers emit
// request.start/request.end timings (after the routers it would only run for
// unmatched /api paths hitting the 404 fallback).
app.use('/api', requestLogger);

// --- API routes ---
for (const router of apiRouters) {
  app.use('/api', router);
}

// --- Static frontend + SPA fallback ---
const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
// --- API 404: /api/* desconocido devuelve 404 JSON (no lo enmascara el SPA fallback) ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// --- Global error handler ---
app.use((err, req, res, _next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'JSON inválido en el body de la request' });
  }
  if (err.status === 429) {
    return res.status(429).json({ error: 'Demasiadas requests. Intentá de nuevo en un momento.' });
  }
  const log = req.log || console;
  log.error?.('unhandled_error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  }) || console.error('Unhandled error:', err);
  const message = NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : (err.message || 'Error interno del servidor');
  res.status(500).json({ error: message });
});

// --- Listen ---
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '127.0.0.1';

const isMain = process.argv[1] && (
  process.argv[1] === __filename ||
  process.argv[1].replace(/\\/g, '/').endsWith('index.js')
);

if (isMain) {
  // Fail closed: never expose a non-loopback bind without auth or demo mode.
  assertSafeBind({ host: HOST, apiKey: process.env.API_KEY || '', demoMode: DEMO_MODE });

  // Phase 2 live sync: the finanzas DB is a startup snapshot unless the
  // vault watcher runs. Fire-and-forget — a watcher failure must never
  // prevent boot (dynamic import keeps test-time imports side-effect free).
  // KBL_WATCH=0 disables it (CI).
  import('./lib/finanzas-watcher.mjs')
    .then((m) => m.startFinanzasWatcher())
    .catch((err) => console.warn('Finanzas watcher failed to start:', err?.message || err));
  app.listen(PORT, HOST, () => {
    console.log(`KBL Admin API running on http://${HOST}:${PORT}`);
  });
}

export { app };
