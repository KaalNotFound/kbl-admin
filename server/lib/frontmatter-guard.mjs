/**
 * Frontmatter guard — inline-frontmatter injection defense (OWASP A08).
 *
 * Vault notes are parsed by trusted regexes that treat every `key:: value`
 * line as structured data (finanzas watcher, inventory scan, daily upserts).
 * Any client string interpolated into those lines must be neutralized first,
 * or a newline / `::` sequence in the value forges extra fields the parser
 * will trust (`entity_type::`, `precio_total::`, …).
 */

const SINGLE_LINE_MAX = 500;
const MULTILINE_MAX = 4000;

// A line that starts a new `key::` field: word-ish label (no leading
// whitespace) optionally spaced, then the `::` separator.
const FORGED_FIELD_LINE = /^(?!\s)[\w -]+\s*::/;

/**
 * Collapse a client value into one inert inline-field line: newlines become
 * spaces, control chars are removed, `::` is neutralized to `: :`, then
 * trimmed and capped — the result cannot open a new frontmatter field.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeFrontmatterValue(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/::/g, ': :')
    .trim()
    .slice(0, SINGLE_LINE_MAX);
}

/**
 * Sanitize a multi-line note field: newlines are preserved, but any line
 * that itself looks like `key:: value` gets a leading space so parsers
 * treat it as plain text. Length capped at MULTILINE_MAX.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeMultilineField(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .split('\n')
    .map((line) => (FORGED_FIELD_LINE.test(line) ? ` ${line}` : line))
    .join('\n')
    .slice(0, MULTILINE_MAX);
}
