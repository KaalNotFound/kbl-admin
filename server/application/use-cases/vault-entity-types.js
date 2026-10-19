/**
 * Entity types use cases — Torre vault-helpers (ADR-025, 2026-08-04).
 *
 * Re-capetización de routes/entity-types.mjs: la lógica de dominio (scan
 * recursivo de entity_type:: inline + lectura de ENTITY_CATALOG.json) vive
 * acá, con deps de fs inyectadas ({ VAULT_ROOT, listDir, readFile, existsSync }).
 * El router solo delega a req.useCases.entityTypes.
 *
 * Bug fix dentro de la torre: listDir del adapter devuelve [{ name, isDirectory }]
 * (no strings) — el router original hacía path.join(dirPath, item) con el objeto
 * → statSync lanzaba → catch {} silencioso → el scan devolvía vacío SIEMPRE.
 * Acá se usa item.name e item.isDirectory.
 */
import path from 'path';

export function createEntityTypesUseCases({ vault }) {
  const { VAULT_ROOT, listDir, readFile, existsSync } = vault;

  async function getEntityTypes() {
    const results = {};
    let totalWithType = 0;

    function scanDir(dirPath) {
      if (!existsSync(dirPath)) return;
      const items = listDir(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory) {
          // Dotfiles y node_modules no se escanean (comportamiento original)
          if (!item.name.startsWith('.') && item.name !== 'node_modules') scanDir(fullPath);
        } else if (item.name.endsWith('.md')) {
          // readFile del adapter devuelve null en error (reemplaza el catch {} original)
          const content = readFile(fullPath);
          if (!content) continue;
          const match = content.match(/^entity_type::\s*(.+)/m);
          if (match) {
            const type = match[1].trim();
            results[type] = (results[type] || 0) + 1;
            totalWithType++;
          }
        }
      }
    }

    scanDir(VAULT_ROOT);

    const types = Object.entries(results)
      .map(([type, count]) => ({ type, count, pct: totalWithType > 0 ? Math.round((count / totalWithType) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    return { types, total: totalWithType };
  }

  async function getEntityCatalog() {
    const catalogPath = path.join(VAULT_ROOT, '07 - SCRIPTS', 'ENTITY_CATALOG.json');
    if (!existsSync(catalogPath)) return [];
    const catalog = JSON.parse(readFile(catalogPath));
    return (catalog.entities || []).map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description || '',
    }));
  }

  return { getEntityTypes, getEntityCatalog };
}
