import puppeteer from 'puppeteer-core';

const CDP_URL = 'http://127.0.0.1:9222';
const WA_URL = 'https://web.whatsapp.com';

let _browser = null;
let _cdpSession = null;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const CDP_DISCOVERY_TIMEOUT_MS = 5000;

/**
 * Resolve the DevTools WebSocket endpoint behind a bounded fetch.
 *
 * puppeteer.connect({ browserURL }) performs this discovery GET itself
 * (puppeteer-core BrowserConnector#getWSEndpoint) with global fetch and NO
 * timeout — a wedged Brave would hang every WhatsApp route. Probe first with
 * a hard AbortSignal, then connect to the resolved webSocketDebuggerUrl.
 *
 * @param {string} rootUrl - CDP base URL (e.g. 'http://127.0.0.1:9222')
 * @returns {Promise<string>} webSocketDebuggerUrl from the DevTools endpoint
 */
export async function resolveCdpEndpoint(rootUrl) {
  const endpointURL = new URL('/json/version', rootUrl);
  const result = await fetch(endpointURL.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(CDP_DISCOVERY_TIMEOUT_MS),
  });
  if (!result.ok) throw new Error('HTTP ' + result.status);
  const data = await result.json();
  return data.webSocketDebuggerUrl;
}

async function getWhatsAppPage(browser) {
  const pages = await browser.pages();
  const wa = pages.find(p => p.url().startsWith(WA_URL));
  if (!wa) throw new Error('WhatsApp Web no esta abierto en ninguna pestana');
  return wa;
}

async function ensureLoggedIn(wa) {
  return await wa.evaluate(() => {
    if (document.querySelector('[data-ref]')) return 'ready';
    if (document.querySelector('canvas')) return 'qr';
    if (document.querySelector('[data-animate-login]')) return 'landing';
    if (document.querySelector('[data-testid="qrcode"]')) return 'qr';
    return 'unknown';
  });
}

export class BraveCdpAdapter {
  async connect() {
    try {
      if (_browser && _browser.isConnected()) return;
      for (let i = 0; i < 3; i++) {
        try {
          const wsEndpoint = await resolveCdpEndpoint(CDP_URL);
          _browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: null });
          // A real browser can disappear at any time (tab closed, WhatsApp
          // navigation, Brave restart). Track the disconnect so the next
          // call reconnects instead of using a dead handle, and so detach
          // events don't leak unhandled rejections past the process-level
          // safety net.
          _browser.on('disconnected', () => { _browser = null; });
          return;
        } catch (err) {
          if (i === 2) throw new Error('CDP no conecta en ' + CDP_URL + ': ' + err.message);
          await sleep(1000 * Math.pow(2, i));
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async disconnect() {
    if (_browser) {
      try { _browser.disconnect(); } catch (e) { /* ignore */ }
      _browser = null;
    }
  }

  async scanUnreadChats() {
    await this.connect();
    const browser = _browser;
    const wa = await getWhatsAppPage(browser);
    const state = await ensureLoggedIn(wa);
    if (state !== 'ready') throw new Error('WhatsApp no esta listo: ' + state);

    return await wa.evaluate(() => {
      const results = [];
      const rows = document.querySelectorAll('[role="row"]');
      for (const row of rows) {
        const nameEl = row.querySelector('[data-testid="msg-header-title-container"]');
        const unreadEl = row.querySelector('[data-testid="icon-unread-count"]');
        const previewEl = row.querySelector('[data-testid="last-msg-status"]');
        const avatarEl = row.querySelector('[data-testid="avatar-default"]') ||
                         row.querySelector('[data-testid="chat-list-item-avatar"] img');

        const name = nameEl ? nameEl.textContent.trim() : null;
        if (!name) continue;

        const unread = unreadEl ? parseInt(unreadEl.textContent.trim() || '0', 10) : 0;
        const lastMessage = previewEl ? previewEl.textContent.trim() : '';

        results.push({
          name: name,
          unread: unread,
          lastMessage: lastMessage,
          hasAvatar: !!avatarEl,
        });
      }
      return results.filter(c => c.unread > 0 || c.lastMessage);
    });
  }

  async extractConversation(contactName) {
    if (!contactName || !contactName.trim()) {
      throw new Error('Nombre del contacto es requerido');
    }

    await this.connect();
    const browser = _browser;
    const wa = await getWhatsAppPage(browser);
    const state = await ensureLoggedIn(wa);
    if (state !== 'ready') throw new Error('WhatsApp no esta listo: ' + state);

    const cdp = _cdpSession || await wa.createCDPSession();
    _cdpSession = cdp;

    const input = await wa.$('[data-testid="chat-list-search"]');
    if (!input) throw new Error('No se encontro el campo de busqueda');

    await input.click();
    await sleep(300);
    await input.type(contactName, { delay: 50 });
    await sleep(1000);

    const coords = await wa.evaluate((name) => {
      const spans = document.querySelectorAll('[data-testid="msg-header-title-container"]');
      for (const span of spans) {
        if (span.textContent.trim().toLowerCase().includes(name.toLowerCase())) {
          const rect = span.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    }, contactName);

    if (!coords) throw new Error('Contacto "' + contactName + '" no encontrado');

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1,
    });
    await sleep(1500);

    const messages = await wa.evaluate(() => {
      const results = [];
      const spans = document.querySelectorAll('[data-testid="message-text"]');
      if (spans.length > 0) {
        for (const span of spans) {
          let outgoing = false;
          let p = span.parentElement;
          while (p && !p.getAttribute('data-testid')) {
            if (p.classList.contains('message-in')) { outgoing = false; break; }
            if (p.classList.contains('message-out')) { outgoing = true; break; }
            p = p.parentElement;
          }
          results.push({
            text: span.textContent.trim(),
            outgoing: outgoing,
          });
        }
        return results;
      }
      const divs = document.querySelectorAll('[data-testid="bubble"]');
      for (const div of divs) {
        const textEl = div.querySelector('[data-testid="message-text"]') ||
                       div.querySelector('.selectable-text');
        if (!textEl) continue;
        let outgoing = false;
        let p = div.parentElement;
        while (p && !p.getAttribute('data-testid')) {
          if (p.classList.contains('message-in')) { outgoing = false; break; }
          if (p.classList.contains('message-out')) { outgoing = true; break; }
          p = p.parentElement;
        }
        results.push({
          text: textEl.textContent.trim(),
          outgoing: outgoing,
        });
      }
      return results;
    });

    return { messages: messages, contact: contactName };
  }
}
