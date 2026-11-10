import { Router } from 'express';
import { logAndRespond } from '../lib/error-handler.mjs';
import { createScopedRateLimiter } from '../middleware/security.mjs';

const router = Router();

// CDP activation spawns browser-side actions; quota it like other control
// surfaces (see security-rate-writes.test.js).
const activateLimiter = createScopedRateLimiter({ max: 10 });

// GET /api/brave/tabs -- proxy a CDP :9222 (use-case con cache TTL + retry)
router.get('/brave/tabs', async (req, res) => {
  try {
    const data = await req.useCases.brave.getTabs();
    res.json(data);
  } catch (e) {
    res.status(503).json(logAndRespond('brave', 'GET', '/api/brave/tabs', e,
      'Brave CDP no disponible. Abre Brave con WhatsApp Web y asegurate de que el puerto 9222 esta habilitado.'));
  }
});

// POST /api/brave/activate -- activar pestaña vía CDP (contrato api.test.js:150-162)
router.post('/brave/activate', activateLimiter, async (req, res) => {
  try {
    const { targetId } = req.body || {};
    if (!targetId) {
      return res.status(400).json({ error: 'targetId es requerido' });
    }
    const result = await req.useCases.brave.activateTab(targetId);
    if (result.status === 400) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(503).json(logAndRespond('brave', 'POST', '/api/brave/activate', e,
      'No se pudo activar la pestaña. Verifica que el puerto 9222 esta habilitado.'));
  }
});

// GET /api/brave/whatsapp/chat/:name -- extract conversation
router.get('/brave/whatsapp/chat/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const result = await req.useCases.brave.getChat(name);
    if (result.status === 400) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(503).json(logAndRespond('brave', 'GET', '/api/brave/whatsapp/chat/:name', e,
      'No se pudo extraer el chat -- el contacto puede no estar visible en WhatsApp Web'));
  }
});

export default router;
