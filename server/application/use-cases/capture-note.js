/**
 * CaptureNote — Use Case
 *
 * Orchestrates: validate DTO → triage by entityType → build markdown →
 * write via injected vault helpers → return Result.
 *
 * Phase 3 (capture triage): the note lands in the vault location the
 * finanzas watcher actually owns, per note type —
 *   - compra            → Compras/ tickets with parser-compatible inline fields
 *   - food (comida/…)   → Daily notes, inline-field upsert (last-match rule)
 *   - default           → 00 - INBOX (the UI copy finally becomes true)
 *
 * Backward compatibility: a payload without `fields` still renders the
 * ORIGINAL default template; passing a `vault` port (vaultFsApi shape,
 * wired by the di-container like phase 1 did) is what unlocks triage plus
 * the { filePath, obsidianUrl } return contract — all paths VAULT-RELATIVE.
 * Without `vault`, the legacy contentStore behavior is preserved untouched.
 *
 * @param {{ contentStore?: ContentStore, eventBus?: EventBus, vault?: VaultFsApi }} deps
 * @returns {(dto: CaptureNoteDto) => Promise<Result<{filePath: string, obsidianUrl?: string}>>}
 */
import path from 'path';
import { Result, ValidationError, InfrastructureError } from '#domain';
import { sanitizeFrontmatterValue } from '../../lib/frontmatter-guard.mjs';

export function createCaptureNote({ contentStore, eventBus, vault }) {
  return async function captureNote(dto) {
    dto = dto || {};

    // Triage path — unlocked by the injected vault port.
    if (vault) {
      return captureWithTriage(dto, { vault, eventBus });
    }

    // Legacy path — kept byte-compatible for callers without the port.
    const STUDY_PATH = '02 - APRENDIZAJE/MoureDev-Master';
    const INBOX_DIR = `${STUDY_PATH}/_campus/_inbox`;

    const dirResult = await contentStore.ensureDir(INBOX_DIR);
    if (dirResult.isFailure) return dirResult;

    const slug = generateSlug(dto.title);
    const date = new Date().toISOString().split('T')[0];
    const filename = `${slug}-${date}.md`;

    const frontmatter = buildFrontmatter({
      'entity_type::': dto.entityType,
      'source::': dto.sourceUrl,
      'fecha_captura::': date,
      'tags::': dto.tags,
      'conceptos_clave::': '',
      'status::': 'pending',
      'priority::': dto.priority,
      'energy::': dto.energy,
      'focus::': dto.focus,
    });

    const noteContent = `${frontmatter}\n\n# ${dto.title}\n\n${dto.content}\n`;

    const filePath = `${INBOX_DIR}/${filename}`;

    const writeResult = await contentStore.write(filePath, noteContent);
    if (writeResult.isFailure) return writeResult;

    if (eventBus) {
      await eventBus.publish({
        type: 'note.captured',
        payload: { filePath, entityType: dto.entityType, title: dto.title },
      });
    }

    return Result.ok({ filePath });
  };
}

// ─── Phase 3: triage + structured captures (vault port) ────────────────────

const FOOD_SLOTS = ['madrugada', 'manana', 'mediodia', 'tarde', 'noche'];

// Fixed vault layout (Johnny-Decimal). `segments` feeds platform-aware
// path.join against the vault port; `dir` is the portable 'a/b/c' form the
// API/tests return.
const TRIAGE_DIRS = {
  compra: { segments: ['02 - AREAS', '008 - Trazabilidad Compras', 'Compras'] },
  food: { segments: ['05 - JOURNAL', 'Daily'] },
  default: { segments: ['00 - INBOX'] },
};

/**
 * Directory triage table — VAULT-RELATIVE destination per entityType.
 * Exported for tests.
 * @param {string} [entityType]
 * @returns {{ kind: 'compra'|'food'|'default', dir: string, segments: string[] }}
 */
export function resolveDirectory(entityType) {
  const id = String(entityType || '').toLowerCase().trim();
  if (id === 'compra') {
    return { kind: 'compra', ...triageShape(TRIAGE_DIRS.compra) };
  }
  if (id === 'food' || id === 'comida' || id === 'food-sora') {
    return { kind: 'food', ...triageShape(TRIAGE_DIRS.food) };
  }
  return { kind: 'default', ...triageShape(TRIAGE_DIRS.default) };
}

function triageShape(dir) {
  return { dir: dir.segments.join('/'), segments: dir.segments };
}

// ─── Pure helpers shared by the triage kinds ────────────────────────────────

/** Normalize the optional capture date (null when malformed). */
function normalizeDate(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return new Date().toISOString().split('T')[0];
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? String(raw) : null;
}

/** First non-empty trimmed line of the note content (producto fallback). */
function firstContentLine(content) {
  return String(content || '').split('\n').map(l => l.trim()).find(Boolean) || '';
}

/** Pure: remove every line of a Daily inline field (tolerates '- ' bullets). */
export function stripDailyFieldLines(content, fieldKey) {
  const rx = new RegExp(`^[ \\t]*-?[ \\t]*${fieldKey}\\s*::`);
  return String(content || '').split('\n').filter(line => !rx.test(line));
}

/** Pure: compra ticket note in the exact inline-field format the
 *  finanzas parser (parseComprasFile) consumes. */
function buildCompraNote(dto, date) {
  const fields = dto.fields || {};
  // Values are parser-trusted `key:: value` lines — sanitize every client
  // string so it cannot forge an extra field (frontmatter injection).
  const comercio = sanitizeFrontmatterValue(fields.comercio);
  const producto = sanitizeFrontmatterValue(fields.producto)
    || sanitizeFrontmatterValue(firstContentLine(dto.content));
  const cantidad = sanitizeFrontmatterValue(fields.cantidad) || '1';
  const precioTotal = sanitizeFrontmatterValue(fields.precio_total);
  const categoria = sanitizeFrontmatterValue(fields.categoria);

  const frontmatter = buildFrontmatter({
    'entity_type::': 'compra',
    'fecha_captura::': date,
    'tags::': '[capture, finanzas]',
    'status::': 'pending',
  });

  const body = [
    `fecha:: ${date}`,
    `comercio:: ${comercio}`,
    `producto:: ${producto}`,
    `cantidad:: ${cantidad}`,
    `precio_total:: ${precioTotal}`,
    `categoria:: ${categoria}`,
  ].join('\n');

  return `${frontmatter}\n\n${body}\n\n# ${producto}\n`;
}

/** Pure: the ORIGINAL default template (frontmatter + # Title + content). */
function buildDefaultNote(dto, date) {
  const content = String(dto.content || '').trim();
  const title = dto.title || content.slice(0, 60);

  const frontmatter = buildFrontmatter({
    'entity_type::': dto.entityType,
    'source::': dto.sourceUrl,
    'fecha_captura::': date,
    'tags::': dto.tags,
    'conceptos_clave::': '',
    'status::': 'pending',
    'priority::': dto.priority,
    'energy::': dto.energy,
    'focus::': dto.focus,
  });

  return `${frontmatter}\n\n# ${title}\n\n${content}\n`;
}

// ─── Vault-port fs helpers ─────────────────────────────────────────────────

function ensureVaultDir(vault, segments) {
  return Boolean(vault.ensureDir(path.join(vault.VAULT_ROOT, ...segments)));
}

function writeVaultNote(vault, segments, filename, content) {
  return Boolean(vault.writeFile(path.join(vault.VAULT_ROOT, ...segments, filename), content));
}

/**
 * Daily upsert — if the Daily note is missing → create it with a
 * `# Diario` header + the field line; if it exists → remove ALL lines for
 * that field, then append ONE clean `<fieldKey>:: <value>` line, so
 * parseFoodSoraFile()'s last-non-empty-match rule is deterministic.
 * Exported for tests.
 */
export async function upsertDailyInlineField(vault, date, fieldKey, value) {
  const segments = TRIAGE_DIRS.food.segments;
  const relativePath = `${segments.join('/')}/${date}.md`;

  const existing = vault.readFile(path.join(vault.VAULT_ROOT, relativePath)) || '';
  const kept = stripDailyFieldLines(existing, fieldKey);
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
  const body = kept.join('\n').replace(/\n+$/, '');

  const content = body
    ? `${body}\n\n${fieldKey}:: ${value}\n`
    : `# Diario\n\n${fieldKey}:: ${value}\n`;

  if (!ensureVaultDir(vault, segments)) {
    return Result.fail(new InfrastructureError(`Could not ensure Daily dir ${segments.join('/')}`));
  }
  if (!writeVaultNote(vault, segments, `${date}.md`, content)) {
    return Result.fail(new InfrastructureError(`Could not write Daily note ${relativePath}`));
  }
  return Result.ok(relativePath);
}

// ─── Orchestrator (triage path) ─────────────────────────────────────────────

async function captureWithTriage(dto, { vault, eventBus }) {
  const triage = resolveDirectory(dto.entityType);
  const fields = dto.fields || {};

  const date = normalizeDate(dto.date);
  if (date === null) {
    return Result.fail(new ValidationError(
      `Capture date must be YYYY-MM-DD, received "${dto.date}"`,
      'date',
    ));
  }

  if (triage.kind === 'food') {
    const slot = String(fields.slot || '').toLowerCase().trim();
    if (!FOOD_SLOTS.includes(slot)) {
      return Result.fail(new ValidationError(
        `Invalid food slot "${slot || '(empty)'}": use one of ${FOOD_SLOTS.join(', ')}`,
        'slot',
      ));
    }
    const hora = String(fields.hora ?? '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(hora)) {
      return Result.fail(new ValidationError(
        `Hora must be HH:MM, received "${hora || '(empty)'}"`,
        'hora',
      ));
    }

    const upsert = await upsertDailyInlineField(vault, date, `${slot}_food_sora`, hora);
    if (upsert.isFailure) return upsert;
    return finishCapture({ filePath: upsert.value }, { dto, vault, eventBus });
  }

  if (triage.kind === 'compra') {
    const comercio = String(fields.comercio ?? '').trim();
    const producto = String(fields.producto ?? '').trim() || firstContentLine(dto.content);
    if (!comercio) {
      return Result.fail(new ValidationError(
        'A compra capture needs fields.comercio (store name) — it names the ticket file',
        'comercio',
      ));
    }
    if (!producto) {
      return Result.fail(new ValidationError(
        'A compra capture needs a producto: set fields.producto or type it as the first line of the note',
        'producto',
      ));
    }

    const slug = generateSlug(comercio);
    const filename = slug ? `${date}_${slug}.md` : `${date}.md`;
    if (!ensureVaultDir(vault, triage.segments)) {
      return Result.fail(new InfrastructureError(`Could not ensure Compras dir`));
    }
    if (!writeVaultNote(vault, triage.segments, filename, buildCompraNote(dto, date))) {
      return Result.fail(new InfrastructureError(`Could not write compra ticket ${filename}`));
    }
    const filePath = `${triage.dir}/${filename}`;
    return finishCapture({ filePath }, { dto, vault, eventBus });
  }

  // default (quick-capture + unclassified entity ids)
  const content = String(dto.content || '').trim();
  if (!content) {
    return Result.fail(new ValidationError('content is required', 'content'));
  }

  const slug = generateSlug(dto.title || content.slice(0, 60));
  const filename = `${slug}-${date}.md`;
  if (!ensureVaultDir(vault, triage.segments)) {
    return Result.fail(new InfrastructureError(`Could not ensure INBOX dir`));
  }
  if (!writeVaultNote(vault, triage.segments, filename, buildDefaultNote(dto, date))) {
    return Result.fail(new InfrastructureError(`Could not write note ${filename}`));
  }
  const filePath = `${triage.dir}/${filename}`;
  return finishCapture({ filePath }, { dto, vault, eventBus });
}

/** Shared success contract: vault-relative path + obsidian deep link. */
function finishCapture({ filePath }, { dto, vault, eventBus }) {
  if (eventBus) {
    eventBus.publish({
      type: 'note.captured',
      payload: { filePath, entityType: dto.entityType, title: dto.title },
    });
  }
  const buildUrl = vault.obsidianUrl;
  return Result.ok({
    filePath,
    obsidianUrl: typeof buildUrl === 'function' ? buildUrl(filePath) : null,
  });
}

// ─── Helpers (pure functions) ───────────────────────────────

function generateSlug(text, maxLen = 40) {
  return text
    .slice(0, maxLen)
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function buildFrontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== '' && value !== undefined && value !== null) {
      lines.push(`${key} ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
