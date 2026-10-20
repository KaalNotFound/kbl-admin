// vault.ts — dominio Vault (overview/queue/projects/entities/inventory/context/todos/capture) (ADR-026)
import { fetchJSON } from './client'
import type {
  Overview,
  Queue,
  ProjectsResponse,
  EntityTypesResponse,
  EntityCatalogEntry,
  InventoryResponse,
  InventoryItem,
  SessionContextData,
  TodosResponse,
  TodosMetrics,
  TodosGraph,
  TodoToggleResponse,
  VaultDoctorResponse,
} from '../types'

export function fetchOverview(): Promise<Overview> {
  return fetchJSON<Overview>(`/api/overview`)
}

export function fetchQueue(): Promise<Queue> {
  return fetchJSON<Queue>(`/api/queue`)
}

export function fetchProjects(): Promise<ProjectsResponse> {
  return fetchJSON<ProjectsResponse>(`/api/projects`)
}

export function fetchEntityTypes(): Promise<EntityTypesResponse> {
  return fetchJSON<EntityTypesResponse>(`/api/entity-types`)
}

export function fetchEntityCatalog(): Promise<EntityCatalogEntry[]> {
  return fetchJSON<EntityCatalogEntry[]>(`/api/entity-catalog`)
}

export type CaptureFields = { slot?: string; hora?: string; comercio?: string; producto?: string; precio_total?: string; categoria?: string; [key: string]: string | number | undefined }
export type CaptureResponse = { success: boolean; path: string; obsidian_url?: string | null }

// Phase 3 capture triage: an optional `fields` map carries the per-type
// structured data (compra → comercio/precio_total/categoria, food → slot/hora)
// and `date` (YYYY-MM-DD, defaults to today server-side). RAW price strings
// ('42,75') travel untouched — parsing happens server-side only.
export function sendCapture(
  content: string,
  source: string,
  entityType?: string,
  fields?: CaptureFields,
  date?: string,
): Promise<CaptureResponse> {
  return fetch(`/api/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      source,
      entityType: entityType || null,
      fields: fields || null,
      date: date || null,
    }),
  }).then(r => r.json())
}

export function fetchInventory(): Promise<InventoryResponse> {
  return fetchJSON<InventoryResponse>(`/api/inventory`)
}

export function createInventoryItem(data: {
  name: string
  category: string
  quantity?: number
  unit?: string
  min_stock?: number
  expiry?: string
  notes?: string
}): Promise<{ success: boolean; item: InventoryItem }> {
  return fetch(`/api/inventory/item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json())
}

export function fetchSessionContext(): Promise<SessionContextData> {
  return fetchJSON<SessionContextData>(`/api/context`)
}

export function fetchTodos(): Promise<TodosResponse> {
  return fetchJSON<TodosResponse>(`/api/todos`)
}

export function fetchTodosMetrics(): Promise<TodosMetrics> {
  return fetchJSON<TodosMetrics>(`/api/todos/metrics`)
}

export function fetchTodosGraph(): Promise<TodosGraph> {
  return fetchJSON<TodosGraph>(`/api/todos/graph`)
}

// Phase 4 write-back: flips a task's done marker inside the SSOT
// `_PENDING.md`. The server re-reads the file fresh; `line` (0-based, from
// the item shape) disambiguates duplicate titles, so send id + line. The
// caller integrates the returned refreshed item into local state.
export function toggleTodo(ref: { id: string; line?: number }): Promise<TodoToggleResponse> {
  return fetch(`/api/todos/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ref),
  }).then(r => r.json())
}

// Phase 5 Vault Doctor: per-request schema lint of the four finans zones
// plus the runtime per-source diagnostics. The server reads files FRESH on
// every call (vault is the SSOT) — no client caching layer assumed.
export function fetchVaultDoctor(): Promise<VaultDoctorResponse> {
  return fetchJSON<VaultDoctorResponse>(`/api/vault-doctor`)
}
