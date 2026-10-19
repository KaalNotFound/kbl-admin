/**
 * StructuredLogger — JSON structured logging with correlationId support.
 *
 * Every log entry is a single JSON line (NDJSON) with:
 *   { ts, level, correlationId, message, context, ...meta }
 *
 * Usage:
 *   const logger = new StructuredLogger({ service: 'kbl-admin', correlationId: reqId });
 *   logger.info('Mastery updated', { conceptId: 'abc', score: 85 });
 *   logger.error('Vault write failed', { path: '/inbox/note.md', error: err.message });
 *
 * Levels: debug < info < warn < error
 * Output: process.stdout (info+) or process.stderr (error+)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class StructuredLogger {
  /**
   * @param {object} opts
   * @param {string} opts.service - Service name (default: 'kbl-admin')
   * @param {string} [opts.correlationId] - Request correlation ID
   * @param {string} [opts.minLevel] - Minimum log level (default: 'info')
   * @param {boolean} [opts.console] - Also write to console (default: false in production)
   */
  constructor({ service = 'kbl-admin', correlationId = null, minLevel = 'info', console: useConsole = false } = {}) {
    this.service = service;
    this.correlationId = correlationId;
    this.minLevel = LEVELS[minLevel] ?? LEVELS.info;
    this.useConsole = useConsole;
  }

  /**
   * Create a child logger with additional context.
   * @param {object} context - Additional fields to include in every log entry
   * @returns {StructuredLogger}
   */
  child(context) {
    const childLogger = new StructuredLogger({
      service: this.service,
      correlationId: this.correlationId,
      minLevel: Object.keys(LEVELS).find(k => LEVELS[k] === this.minLevel) || 'info',
      console: this.useConsole,
    });
    childLogger._defaultContext = { ...this._defaultContext, ...context };
    return childLogger;
  }

  /**
   * Set correlationId after construction (useful for middleware wiring).
   */
  setCorrelationId(id) {
    this.correlationId = id;
  }

  /**
   * Log a message at the given level.
   * @param {string} level
   * @param {string} message
   * @param {object} [meta] - Additional metadata
   */
  _log(level, message, meta = {}) {
    if (LEVELS[level] < this.minLevel) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      service: this.service,
      correlationId: this.correlationId,
      message,
      ...this._defaultContext,
      ...meta,
    };

    const line = JSON.stringify(entry);

    // error → stderr, rest → stdout
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }

    // Optional console output for development
    if (this.useConsole) {
      const prefix = `[${entry.ts}] [${level.toUpperCase()}]`;
      const corrStr = entry.correlationId ? ` [${entry.correlationId}]` : '';
      const msg = `${prefix}${corrStr} ${message}`;
      if (level === 'error') {
        console.error(msg, Object.keys(meta).length ? meta : '');
      } else if (level === 'warn') {
        console.warn(msg, Object.keys(meta).length ? meta : '');
      } else {
        console.log(msg, Object.keys(meta).length ? meta : '');
      }
    }
  }

  debug(message, meta) { this._log('debug', message, meta); }
  info(message, meta) { this._log('info', message, meta); }
  warn(message, meta) { this._log('warn', message, meta); }
  error(message, meta) { this._log('error', message, meta); }

  /**
   * Create a timer that logs elapsed time when stop() is called.
   * @param {string} label - Timer label
   * @returns {{ stop: (meta?: object) => void }}
   */
  startTimer(label) {
    const start = performance.now();
    return {
      stop: (meta = {}) => {
        const elapsed = Math.round((performance.now() - start) * 100) / 100;
        this.info(`${label} completed`, { durationMs: elapsed, ...meta });
      },
    };
  }
}

/**
 * Create a root logger for the application.
 * @param {object} [opts]
 * @returns {StructuredLogger}
 */
function createLogger(opts = {}) {
  const isDev = process.env.NODE_ENV !== 'production';
  return new StructuredLogger({
    service: opts.service || 'kbl-admin',
    minLevel: opts.minLevel || (isDev ? 'debug' : 'info'),
    console: opts.console ?? isDev,
    ...opts,
  });
}

export { StructuredLogger, createLogger };
