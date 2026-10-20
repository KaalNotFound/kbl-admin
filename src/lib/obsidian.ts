// obsidian.ts — Data provenance helpers (Phase 1)
// Vault rows carry an `obsidian_url` built by the backend
// (obsidian://open?path=<absolute fs path>, per https://obsidian.md/help/uri).

/** Anchor attributes that link out to Obsidian without reverse-tabnabbing. */
export function obsidianAnchor(url: string): {
  href: string
  target: '_blank'
  rel: 'noopener noreferrer'
} {
  return { href: url, target: '_blank', rel: 'noopener noreferrer' }
}

/** Programmatic open (for buttons/handlers) — opens the note in the Obsidian app. */
export function openObsidian(url: string): void {
  window.open(url, '_blank', 'noopener')
}
