// vault-doctor.mjs — Phase 5 router: GET /api/vault-doctor.
//
// Thin router in the sibling style — the scan lives in
// server/lib/vault-doctor.mjs and the wiring (VAULT_ROOT + the Phase 1
// obsidianUrl deep-link helper) mirrors how the provenance rows are built
// for `/api/search` or `/api/food-sora`. The scan runs PER REQUEST on
// fresh file reads: the vault is the SSOT and Obsidian can change it
// between renders, same "fresh read" contract as /api/todos. Cost
// tradeoff, documented deliberately: O(files in the four finans zones)
// per request (~tens of files), acceptable for a self-service audit page;
// revisit with a cache only if a vault grows past that comfortably.
import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'
import { VAULT_ROOT } from '../infrastructure/vault-fs-adapter.mjs'
import { obsidianUrl } from '../lib/obsidian-url.mjs'
import { ensureDb } from '../lib/finanzas-db.mjs'
import { scanVault } from '../lib/vault-doctor.mjs'
import { createScopedRateLimiter } from '../middleware/security.mjs'

const router = Router()

// Full vault scan per request — scoped quota (issue #3, resource abuse).
const scanLimiter = createScopedRateLimiter({ max: 10 });

router.get('/vault-doctor', scanLimiter, async (req, res) => {
  try {
    // ensureDb() populates the runtime per-source status (DB loader +
    // watcher upserts) returned as `diagnostics`; a clean fresh clone
    // may be uninitialized when this is hit first.
    await ensureDb()
    res.json({ ok: true, ...scanVault({ vaultRoot: VAULT_ROOT, obsidianUrl }) })
  } catch (e) {
    res.status(500).json(logAndRespond('vault-doctor', 'GET', '/api/vault-doctor', e, 'Error auditando el vault'))
  }
})

export default router
