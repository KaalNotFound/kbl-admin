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

export function sendCapture(content: string, source: string, entityType?: string): Promise<{ success: boolean; path: string }> {
  return fetch(`/api/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, source, entityType: entityType || null }),
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
