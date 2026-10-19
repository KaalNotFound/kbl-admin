/**
 * NotebookLM use-cases — Torre notebooklm (ADR-025, 2026-08-04).
 *
 * Re-capetización CA: el router routes/notebooklm.mjs importaba
 * lib/notebooklm-proxy.mjs directo (violación R1: router → lib). Ahora el
 * proxy es un PORT inyectado ({ request, health }) y esta factory expone los
 * use-cases que los endpoints consumen vía req.useCases.notebooklm.
 *
 * Los métodos construyen endpoints y validan payloads (Result pattern §2.3:
 * { status, error } para validación; el resto delega en el port y propaga
 * errores del transporte — ECONNREFUSED/timeout — para que el router los
 * mapee con logAndRespond, Ley E3: cero errores silenciosos).
 */

/**
 * @param {{ request: Function, health: Function }} nlm - Port del proxy NLM
 * @returns {object} use-cases notebooklm
 */
export function createNotebooklmUseCases({ nlm }) {
  return {
    // GET /health — envuelto por el router en { success: true, data }
    getHealth: async () => nlm.health(),

    // POST /ask
    ask: async (payload = {}) => {
      const { question, notebook_id, notebook_url, session_id, source_format } = payload;
      if (!question) return { status: 400, error: 'Falta question' };
      return nlm.request('POST', '/ask', {
        question,
        notebook_id,
        notebook_url,
        session_id,
        source_format: source_format || 'json',
      });
    },

    // GET /notebooks
    listNotebooks: async () => nlm.request('GET', '/notebooks'),

    // POST /notebooks
    createNotebook: async (payload = {}) => {
      const { url, name, description, topics } = payload;
      if (!url || !name) return { status: 400, error: 'Faltan url y name' };
      return nlm.request('POST', '/notebooks', { url, name, description, topics });
    },

    // POST /notebooks/create
    createNotebookDirect: async (payload = {}) =>
      nlm.request('POST', '/notebooks/create', { name: payload.name }),

    // GET /notebooks/:id
    getNotebook: async (id) =>
      nlm.request('GET', `/notebooks/${encodeURIComponent(id)}`),

    // DELETE /notebooks/:id
    deleteNotebook: async (id) =>
      nlm.request('DELETE', `/notebooks/${encodeURIComponent(id)}`),

    // PUT /notebooks/:id/activate
    activateNotebook: async (id) =>
      nlm.request('PUT', `/notebooks/${encodeURIComponent(id)}/activate`),

    // GET /notebooks/search?query=
    searchNotebooks: async (query = '') =>
      nlm.request('GET', `/notebooks/search?query=${encodeURIComponent(query)}`),

    // GET /notebooks/stats
    getNotebookStats: async () => nlm.request('GET', '/notebooks/stats'),

    // POST /content/sources
    addContentSource: async (body = {}) => nlm.request('POST', '/content/sources', body),

    // POST /content/generate
    generateContent: async (body = {}) => nlm.request('POST', '/content/generate', body),

    // GET /content?notebook_url=
    listContent: async (notebookUrl = '') => {
      const params = new URLSearchParams();
      if (notebookUrl) params.set('notebook_url', notebookUrl);
      const qs = params.toString() ? `?${params}` : '';
      return nlm.request('GET', `/content${qs}`);
    },

    // POST /content/notes
    createNote: async (body = {}) => nlm.request('POST', '/content/notes', body),

    // GET /sessions
    listSessions: async () => nlm.request('GET', '/sessions'),
  };
}
