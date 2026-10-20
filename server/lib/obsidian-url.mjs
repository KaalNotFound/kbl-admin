// obsidian-url.mjs — Data provenance helper (Phase 1)
// Builds obsidian://open URIs that open the source note in the Obsidian
// desktop app. Per https://obsidian.md/help/uri, the `path` parameter accepts
// an absolute filesystem path and Obsidian itself resolves which vault
// contains it, so we always emit the absolute fs path (single encodeURIComponent).
import path from 'path'
import { VAULT_ROOT } from '../infrastructure/vault-fs-adapter.mjs'

/**
 * Build the obsidian://deep-link for a vault note.
 * Accepts a VAULT-RELATIVE path (e.g. "02 - AREAS/.../Compras/ticket.md") or
 * an already-absolute path; both encode to the same absolute `path` param.
 * @param {string} vaultPathOrRel
 * @returns {string} `obsidian://open?path=<encodeURIComponent(absolute path)>`
 */
export function obsidianUrl(vaultPathOrRel) {
  const abs = path.isAbsolute(vaultPathOrRel)
    ? vaultPathOrRel
    : path.join(VAULT_ROOT, vaultPathOrRel)
  return `obsidian://open?path=${encodeURIComponent(abs)}`
}
