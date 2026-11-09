// client.ts — infra compartida del cliente HTTP (ADR-026)
// Único lugar con fetch directo: BASE + fetchJSON.
// Los módulos de dominio importan fetchJSON desde aquí.

const BASE = '/api'

export async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export { BASE }
