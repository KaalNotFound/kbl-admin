// nlm-guard.mjs — request-size guards for expensive LLM endpoints (LLM04).
//
// Routers call these BEFORE dispatching to the use-cases so oversized
// free-text payloads are rejected with a 400 instead of reaching the
// notebooklm-mcp proxy (which would burn quota/latency on them).

/** Upper bound for free-text fields forwarded to the LLM proxy. */
export const MAX_TEXT_CHARS = 8000;

/**
 * Check one free-text field of a JSON body. Absent/null fields pass (the
 * use-case decides requiredness); anything present must be a string within
 * MAX_TEXT_CHARS. Returns a { status, error } rejection or null when valid.
 */
export function guardTextField(body, field, message) {
  const value = body?.[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_TEXT_CHARS) {
    return { status: 400, error: message };
  }
  return null;
}

/** /ask guard: the question field, with the endpoint-specific message. */
export function guardQuestion(body) {
  return guardTextField(body, 'question', 'La pregunta excede el máximo de 8000 caracteres.');
}
