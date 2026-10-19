/**
 * Brave use-cases — Torre brave (ADR-025, 2026-08-04).
 *
 * Re-capetización CA: el router routes/brave.mjs importaba el adapter
 * infrastructure/brave-cdp-adapter.js directo (violación R1: router → infra).
 * Ahora el adapter es un PORT inyectado (instancia BraveCdpAdapter) y esta
 * factory expone los use-cases que los endpoints consumen vía
 * req.useCases.brave.
 *
 * Nota de capa (R2, whitelist vacía): application NO importa lib/retry.mjs
 * (cross-cutting whitelisted solo para routers/infra). El retry con backoff
 * es política de aplicación → helper local `retry` que replica el contrato
 * de lib/retry.mjs (maxRetries/baseDelay/label). La cache de tabs también
 * vive acá (estado de presentación de la lectura, no del adapter).
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry con backoff exponencial — espejo local de lib/retry.mjs (R2).
 * @param {Function} fn - Async function a reintentar
 * @param {Object} [opts]
 * @param {number} [opts.maxRetries] - Intentos extra (default 1)
 * @param {number} [opts.baseDelay] - Delay base en ms (default 1000)
 * @param {string} [opts.label] - Etiqueta de log (default 'brave')
 * @returns {Promise<*>} Resultado de fn()
 */
async function retry(fn, { maxRetries = 1, baseDelay = 1000, label = 'brave' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/**
 * @param {{ connect: Function, scanUnreadChats: Function, extractConversation: Function }} brave
 *        - Port del adapter CDP (instancia BraveCdpAdapter inyectada desde el container)
 * @returns {object} use-cases brave
 */
export function createBraveUseCases({ brave }) {
  let braveTabsCache = { data: null, ts: 0 };
  const CACHE_TTL = 2000;

  return {
    // GET /brave/tabs — proxy a CDP :9222 (HTTP /json) con cache TTL 2s + retry (2 extra)
    // Contrato real del endpoint CDP: array de targets {id, type, title, url, ...}.
    // Nota de puerto: el mock de api.test.js (fetch → /json) y el adapter real de
    // Brave NO exponen listTabs(); la lectura HTTP del target list vive acá
    // (mismo patrón que activateTab) — documentado en reporte Daredevil.
    getTabs: async () => {
      const now = Date.now();
      if (braveTabsCache.data && (now - braveTabsCache.ts) < CACHE_TTL) {
        return braveTabsCache.data;
      }
      const raw = await retry(async () => {
        const response = await fetch('http://127.0.0.1:9222/json');
        if (!response.ok) throw new Error('CDP tabs HTTP ' + response.status);
        return await response.json();
      }, { maxRetries: 2, baseDelay: 500, label: 'CDP:brave-tabs' });

      braveTabsCache = { data: raw, ts: Date.now() };
      return raw;
    },

    // GET /brave/whatsapp/chat/:name — extraer conversación (retry 1 extra)
    getChat: async (name) => {
      if (!name || !name.trim()) {
        return { status: 400, error: 'Nombre del contacto es requerido' };
      }
      const result = await retry(() => brave.extractConversation(name), {
        maxRetries: 1,
        baseDelay: 1000,
        label: 'WhatsApp:chat:' + name,
      });
      // El adapter real devuelve { messages, contact }; el mock del test devuelve array.
      const messages = Array.isArray(result) ? result : (result?.messages || []);
      return { messages, contact: name };
    },

    // GET /whatsapp/chats — chats con unread (scanUnreadChats del adapter)
    getChats: async () => {
      return await retry(() => brave.scanUnreadChats(), {
        maxRetries: 1,
        baseDelay: 500,
        label: 'WhatsApp:chats',
      });
    },

    // POST /brave/activate — activar pestaña vía CDP HTTP /json/activate/:id
    // Contrato del mock (api.test.js): fetch stubbeado para /json/activate/* → ok:true.
    activateTab: async (targetId) => {
      if (!targetId) {
        return { status: 400, error: 'targetId es requerido' };
      }
      return await retry(async () => {
        const response = await fetch('http://127.0.0.1:9222/json/activate/' + encodeURIComponent(targetId));
        if (!response.ok) throw new Error('CDP activate HTTP ' + response.status);
        return { success: true };
      }, { maxRetries: 1, baseDelay: 500, label: 'CDP:activate:' + targetId });
    },
  };
}
