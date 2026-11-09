/**
 * Re-capetización Torre vault-helpers — sub-torre inventory (ADR-025, 2026-08-04).
 * Lógica movida verbatim del handler de routes/inventory.mjs (165L) con el fix
 * del bug listDir: el adapter devuelve [{name, isDirectory}], NO strings — el
 * original hacía entry.endsWith()/path.join(dir, entry) sobre objetos → TypeError
 * → catch {} → el scan devolvía [] SIEMPRE (endpoint roto silenciosamente).
 *
 * Sin imports de lib/ ni fs — todo el I/O por deps inyectadas (vault).
 * Result pattern (AGENTS §2.3) en createItem (validación de input del POST).
 */
import path from 'path';
import { sanitizeFrontmatterValue, sanitizeMultilineField } from '../../lib/frontmatter-guard.mjs';

const VALID_CATEGORIES = ['despensa','heladera','freezer','limpieza','higiene','herramientas','documentos','medicamentos','otros'];
const SEVEN_DAYS = 7 * 86400000;

/**
 * @param {{ VAULT_ROOT, listDir, readFile, fileInfo, existsSync, ensureDir, writeFile }} vault
 */
export function createInventoryUseCases({ vault }) {
  const { VAULT_ROOT, listDir, readFile, fileInfo, existsSync, ensureDir, writeFile } = vault;

  const field = (content, key) => {
    const re = new RegExp(`^${key}::\\s*(.+)`, 'm');
    const m = content.match(re);
    return m ? m[1].trim() : '';
  };

  function scanInventory(dirPath, out) {
    if (!existsSync(dirPath)) return;
    const entries = listDir(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const info = fileInfo(fullPath);
      if (!info) continue;
      if (info.isDirectory) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanInventory(fullPath, out);
        }
      } else if (entry.name.endsWith('.md')) {
        const content = readFile(fullPath);
        if (!content || !content.includes('entity_type:: inventory_item')) continue;

        const name = field(content, 'name') || entry.name.replace('.md', '');
        const category = field(content, 'category') || 'otros';
        const qty = parseFloat(field(content, 'quantity')) || 0;
        const minStk = parseFloat(field(content, 'min_stock')) || 1;
        const unit = field(content, 'unit') || 'unidades';
        const expiry = field(content, 'expiry') || '';
        const notes = field(content, 'notes') || '';

        out.push({
          id: entry.name.replace('.md', ''),
          name,
          category,
          quantity: qty,
          unit,
          min_stock: minStk,
          expiry,
          notes,
          added: info.birthtime ? info.birthtime.toISOString() : info.mtime.toISOString(),
          updated: info.mtime.toISOString(),
        });
      }
    }
  }

  return {
    // GET /api/inventory — scan del vault por entity_type:: inventory_item + agregación
    async getInventory() {
      const items = [];
      scanInventory(VAULT_ROOT, items);

      const catAgg = {};
      for (const cat of VALID_CATEGORIES) catAgg[cat] = { count: 0, low_stock: 0 };

      let lowStockCount = 0;
      let expiringSoonCount = 0;
      const now = Date.now();

      for (const item of items) {
        if (!catAgg[item.category]) catAgg[item.category] = { count: 0, low_stock: 0 };
        catAgg[item.category].count++;
        if (item.quantity <= item.min_stock) {
          catAgg[item.category].low_stock++;
          lowStockCount++;
        }
        if (item.expiry) {
          const expDate = new Date(item.expiry).getTime();
          if (!isNaN(expDate) && (expDate - now) < SEVEN_DAYS && expDate > now) {
            expiringSoonCount++;
          }
        }
      }

      return {
        items,
        summary: {
          total_items: items.length,
          categories: catAgg,
          low_stock_items: lowStockCount,
          expiring_soon: expiringSoonCount,
          last_updated: new Date().toISOString(),
        },
      };
    },

    // POST /api/inventory/item — crear nota de inventario (Result pattern)
    async createItem(payload = {}) {
      const { name, category, quantity, unit, min_stock, expiry, notes } = payload;

      if (!name || !name.trim()) return { ok: false, status: 400, error: 'name is required' };
      if (!category) return { ok: false, status: 400, error: 'category is required' };

      const safeName = name.trim().replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-');
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `${safeName}-${dateStr}.md`;
      const inventoryDir = path.join(VAULT_ROOT, '03 - RECURSOS', '_inventory');
      const filePath = path.join(inventoryDir, filename);

      const expiryLine = expiry ? `expiry:: ${expiry}\n` : '';
      // notes/category reach parser-trusted `key:: value` lines — sanitize so
      // a newline or `::` in the value cannot forge an extra field.
      const notesLine = notes && notes.trim() ? `notes:: ${sanitizeMultilineField(notes)}\n` : '';

      const note = `---
created: ${now.toISOString()}
entity_type:: inventory_item
---

# ${name.trim()}

> item de inventario creado desde el dashboard

name:: ${name.trim()}
category:: ${sanitizeFrontmatterValue(category)}
quantity:: ${quantity ?? 1}
unit:: ${unit || 'unidades'}
min_stock:: ${min_stock ?? 1}
${expiryLine}${notesLine}added:: ${now.toISOString()}
updated:: ${now.toISOString()}
`;

      if (!existsSync(inventoryDir)) {
        ensureDir(inventoryDir);
      }

      const written = writeFile(filePath, note);
      if (!written) return { ok: false, status: 500, error: 'no se pudo escribir el archivo de inventario' };

      return {
        ok: true,
        item: {
          id: filename.replace('.md', ''),
          name: name.trim(),
          category,
          quantity: quantity ?? 1,
          unit: unit || 'unidades',
          min_stock: min_stock ?? 1,
          expiry: expiry || '',
          notes: notes?.trim() || '',
          added: now.toISOString(),
          updated: now.toISOString(),
        },
      };
    },
  };
}
