/**
 * KBL Admin — Server Entry Point.
 * Slim orchestrator: app → security → DI → routes → error → listen.
 */
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Infrastructure
import { createContainer } from './di-container.js';
import { createDiMiddleware } from './middleware/di.mjs';
import { correlationIdMiddleware, requestLogger } from './infrastructure/correlation-middleware.js';

// Security + Routes
import { createSecurityMiddleware } from './middleware/security.mjs';
import { apiRouters } from './routes/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

// --- Security ---
app.use(...createSecurityMiddleware());

// --- Body parsing ---
app.use(express.json({ limit: '1mb' }));

// --- DI + Observability ---
const container = createContainer({
  vaultRoot: path.resolve(__dirname, '..', '..'),
});
app.use(correlationIdMiddleware);
app.use(createDiMiddleware(container));

// --- API routes ---
for (const router of apiRouters) {
  app.use('/api', router);
}

// --- Request lifecycle logging ---
app.use('/api', requestLogger);

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
  app.listen(PORT, HOST, () => {
    console.log(`KBL Admin API running on http://${HOST}:${PORT}`);
  });
}

export { app };
