import { Router } from 'express';
import { logAndRespond } from '../lib/error-handler.mjs';

const router = Router();

// GET /api/whatsapp/chats -- chats con unread (reusa scanUnreadChats del adapter brave)
// Contrato (SPEC api.test.js:164-173 + src/api/whatsapp.ts WhatsAppChat):
//   [{ name, last_message, timestamp, unread, avatar_letter }]
router.get('/whatsapp/chats', async (req, res) => {
  try {
    const chats = await req.useCases.brave.getChats();
    const normalized = (Array.isArray(chats) ? chats : []).map((c) => ({
      ...c,
      // El adapter real devuelve `lastMessage`; el contrato del test/front usa `last_message`.
      last_message: c.last_message ?? c.lastMessage ?? '',
    }));
    res.json(normalized);
  } catch (e) {
    res.status(503).json(logAndRespond('whatsapp', 'GET', '/api/whatsapp/chats', e,
      'WhatsApp no disponible. Abre WhatsApp Web y asegurate de que el puerto 9222 esta habilitado.'));
  }
});

// GET /api/whatsapp/chat/:name -- conversación de un contacto
// Contrato (SPEC api.test.js:175-185 + src/api/whatsapp.ts WhatsAppChatResponse):
//   { messages: [{ text, outgoing, timestamp }], contact }
router.get('/whatsapp/chat/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const result = await req.useCases.brave.getChat(name);
    if (result.status === 400) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(503).json(logAndRespond('whatsapp', 'GET', '/api/whatsapp/chat/:name', e,
      'No se pudo extraer el chat -- el contacto puede no estar visible en WhatsApp Web'));
  }
});

export default router;
