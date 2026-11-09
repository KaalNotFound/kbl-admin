// client.ts — infra compartida del cliente HTTP (ADR-026)
// Único lugar con fetch directo: BASE + fetchJSON.
// Los módulos de dominio importan fetchJSON desde aquí.

const BASE = '/api'

// Issue #4 C5: no request hangs forever. Backward compatible — the second
// arg stays the positional `signal` (pomodoro/active-recall pass one);
// timeoutMs defaults to 20s and merges with the caller's signal so either
// aborts the fetch.
const DEFAULT_TIMEOUT_MS = 20_000

export async function fetchJSON<T>(
  url: string,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const merged = signal ? AbortSignal.any([signal, timeout]) : timeout
  const res = await fetch(url, { signal: merged })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export { BASE }
