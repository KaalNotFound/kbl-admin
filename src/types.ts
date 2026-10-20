export type HealthStatus = 'good' | 'warn' | 'bad'

export interface HealthIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface VaultStats {
  total_notes: number
  areas: Record<string, { files: number; note_count: number }>
  inbox_unclassified: number
  entity_catalog_entries: number
}

export interface PipelineStats {
  pending: number
  done: number
  failed: number
  total: number
}

export interface SessionInfo {
  total: number
  last_session: { date: string; duration: string; status: string } | null
}

export interface Overview {
  health: HealthStatus
  health_issues: HealthIssue[]
  vault: VaultStats
  pipeline: PipelineStats
  sessions: SessionInfo
  thermal: ThermalReading[]
}

export interface QueueFile {
  name: string
  size: number
  modified: string
  status: string
}

export interface Queue {
  pending: QueueFile[]
  done: QueueFile[]
  failed: QueueFile[]
}

export interface Project {
  name: string
  status: string
  last_update: string
  description: string
  stack: string[]
  has_agents: boolean
  files_count: number
}

export interface ProjectsResponse {
  projects: Project[]
  stalled: Project[]
}

export interface EntityType {
  type: string
  count: number
  pct: number
}

export interface EntityTypesResponse {
  types: EntityType[]
  total: number
}

export interface ThermalReading {
  fecha?: string
  date?: string
  temperatura?: number
  temperature?: number
  estado?: string
  note?: string
}

export interface Session {
  date?: string
  fecha?: string
  duration?: string
  duracion?: string
  status?: string
  estado?: string
  notas?: string
}

export interface CaptureLog {
  name: string
  size: number
  modified: string
}

export interface LogsResponse {
  sessions: Session[]
  thermal: ThermalReading[]
  capture_logs: CaptureLog[]
}

export interface SeenResponse {
  entries: number
  recent_hashes: Array<{ hash: string; date: string }>
}

// --- Finanzas Personales (integrado en KBL_Admin) ---
// Data provenance (Phase 1): vault-sourced rows expose their source note.
export interface SourceFile {
  file: string
  obsidian_url: string
}
export interface SearchResults {
  results: Array<{
    fecha: string
    comercio: string
    producto: string
    precio_total: number
    historial: Array<{ precio: number; fecha: string }>
    archivo?: string
    obsidian_url?: string | null
  }>
  stores: string[]
}
export interface DailySpending {
  fecha: string
  total: number
}
export interface Category {
  name: string
  total: number
  percent: number
}
export interface StoreStat {
  name: string
  total: number
  visits: number
}
export interface Summary {
  month: string; total: number; daily_avg: number; tickets: number; items: number
  last_month_total: number; change_percent: number | null
  daily_spending: DailySpending[]; top_categories: Category[]; store_stats: StoreStat[]
}
export interface HormigaItem {
  producto: string; veces: number; total_mes: number
}
export interface TopExpensive {
  producto: string; comercio: string; fecha: string; precio: number
}
export interface Insights {
  hormiga: HormigaItem[]; top_expensive: TopExpensive[]
  preocupaciones: string[]; recurrencias: { producto: string; categoria: string; frecuencia: string }[]
}
export interface RunwayData {
  meses: number | string; dias: number | string; fecha_fin: string | null
}
export interface GastoPorCategoria {
  categoria: string; total: number; items: number
}
export interface MercadoDetalle {
  producto: string; pagado: number; mejor_mercado: number
  tienda_mejor: string; tienda_compra: string; tipo: 'ahorro' | 'sobreprecio'; diferencia: number
}
export interface PreciosMercado {
  [store: string]: number | null
}
export interface TablaComparativaItem {
  producto: string; categoria: string; ultimo_precio: number; ultimo_comercio: string; ultima_fecha: string
  precios_mercado: PreciosMercado; mejor_precio: number | null; diferencia: number | null; tipo: 'ahorro' | 'sobreprecio' | null
}
export interface MercadoData {
  total_productos: number; productos_con_precio: number; ahorro_total: number
  detalles: MercadoDetalle[]; tabla_comparativa: TablaComparativaItem[]
  mercados_disponibles: string[]; ultima_actualizacion: string
}
export interface BudgetData {
  limites: Record<string, number>; presupuesto_fijo: number; ingreso_esperado: number
}
export interface Reconciliacion {
  saldo_anterior: number; saldo_actual: number; esperado: number; diferencial: number
  gastos_registrados: number; ingresos_estimados: number; desde_fecha: string
  tiene_diferencial: boolean; interpretacion: string
}
export interface FinanzasData {
  saldo: number; reconciliacion: Reconciliacion | null; ingresos: number; gastos_fijos: number
  gasto_variable_mensual: number; gasto_total_mensual: number; flujo_neto: number; deficit: boolean
  runway: RunwayData; gastos_por_categoria: GastoPorCategoria[]; items_variables: number
  mercado: MercadoData | null; presupuesto: BudgetData | null; version: string
}
export interface CompareItem {
  producto: string; categoria?: string
  precios: { comercio: string; precio: number; fecha: string; archivo?: string; obsidian_url?: string | null }[]
  precios_mercado: PreciosMercado | null; min_price: number; avg_price: number
}
export interface CompareSummary {
  total_products: number; total_entries: number; avg_price_all: number; min_price_all: number; max_price_all: number
}
export interface CompareData {
  query: string; comparison: CompareItem[]; stores: string[]; summary: CompareSummary
}
export interface FoodSoraSlot {
  name: string; count: number; pct: number; avg_hora: string | null
}
export interface CalendarDay {
  fecha: string; slots: Record<string, boolean>; filled: number
}
export interface FoodSoraStats {
  total_days: number; total_slots: number; filled_slots: number; rate: number; streak: number
  by_slot: FoodSoraSlot[]; calendar: CalendarDay[]
}
export interface FoodSoraDay {
  fecha: string; slots: Record<string, string>; filled_slots: number; total_slots: number
  archivo?: string
  obsidian_url?: string | null
}
export interface Asset {
  tipo: string; nombre: string; valor: number; ingreso_generado: number; fecha: string
  archivo?: string
  obsidian_url?: string | null
}
export interface AssetAlloc {
  tipo: string; total: number; pct: number
}
export interface IncomeSource {
  fuente: string; monto: number; tipo: string; fecha: string
}
export interface PatrimonioData {
  assets: Asset[]; total_activos: number; ingresos_pasivos: number; asset_allocation: AssetAlloc[]
  income_sources: IncomeSource[]; total_income_extra: number; income_breakdown: Record<string, number>
  perfil_ingresos: { fuente: string; monto: number; tipo: string }[]
  pasivos_mensuales: number; net_worth: number
}

// --- Integrations (external proxies - obsoletos) ---
export interface IntegrationStatus {
  connected: boolean
  data?: Record<string, unknown>
  error?: string
  detail?: string
}

// --- Inventory (Household) ---
export type InventoryCategory =
  | 'despensa'
  | 'heladera'
  | 'freezer'
  | 'limpieza'
  | 'higiene'
  | 'herramientas'
  | 'documentos'
  | 'medicamentos'
  | 'otros'

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  quantity: number
  unit: string               // kg, L, unidades, etc
  min_stock: number          // alerta si baja de aca
  expiry?: string            // ISO date
  notes?: string
  added: string              // ISO date
  updated: string            // ISO date
}

export interface InventorySummary {
  total_items: number
  categories: Record<InventoryCategory, { count: number; low_stock: number }>
  expiring_soon: number      // items por vencer en < 7 dias
  low_stock_items: number
  last_updated: string
}

export const INVENTORY_CATEGORIES: { id: InventoryCategory; label: string; icon: string }[] = [
  { id: 'despensa',    label: 'Despensa',      icon: '◻' },
  { id: 'heladera',    label: 'Heladera',       icon: '◻' },
  { id: 'freezer',     label: 'Freezer',        icon: '◻' },
  { id: 'limpieza',    label: 'Limpieza',       icon: '◻' },
  { id: 'higiene',     label: 'Higiene',        icon: '◻' },
  { id: 'herramientas',label: 'Herramientas',   icon: '◻' },
  { id: 'documentos',  label: 'Documentos',     icon: '◻' },
  { id: 'medicamentos',label: 'Medicamentos',   icon: '◻' },
  { id: 'otros',       label: 'Otros',          icon: '◻' },
]

export interface InventoryResponse {
  items: InventoryItem[]
  summary: InventorySummary
}

// --- Entity Catalog (for Quick Capture classification) ---
export interface EntityCatalogEntry {
  id: string
  name: string
  description: string
}

// --- Brave Tabs ---
export interface BraveTab {
  id: string
  title: string
  url: string
  favicon?: string
  active: boolean
  type: string
  /** Timestamp when the page was last accessed (ISO string) */
  last_accessed?: string
}

// --- WhatsApp ---
export interface WhatsAppChat {
  name: string
  last_message: string
  timestamp: string
  unread: number
  avatar_letter: string
}

export interface WhatsAppMessage {
  text: string
  outgoing: boolean
  timestamp: string
}

export interface WhatsAppChatResponse {
  messages: WhatsAppMessage[]
  contact: string
}

// --- Session Context (Pendientes + Roadmap + Checkpoints) ---
export interface PendienteItem {
  title: string
  priority: 'Alta' | 'Media' | 'Baja'
  status: string
  project: string
  what: string
}

export interface RoadmapData {
  current: string | null
  pending: string[]
  completed: string[]
}

export interface CheckpointItem {
  date: string
  file: string
  summary: string
  lines: number
}

export interface SessionContextData {
  pendientes: PendienteItem[]
  roadmap: RoadmapData
  checkpoints: CheckpointItem[]
  sources?: SourceFile[]
}

// --- Pomodoro Timer ---
export interface PomodoroStatus {
  active: boolean
  paused: boolean
  phase: string | null
  work_min: number
  break_min: number
  long_break_min: number
  sessions_before_long_break: number
  completed_sessions: number
  current_timer: {
    id: string
    label: string
    type: string
    total_ms: number
    elapsed_ms: number
    remaining_ms: number
    progress: number
  } | null
}

// --- Study Notes ---
export interface StudyConcept {
  note: string
  bloque: number
  concepto: string
  analogia: string
  definicion?: string
}

export interface StudyQuestion {
  note: string
  bloque: number
  question: string
  /** Nombre del concepto relacionado (misma note+bloque) — enriquecido por backend */
  linkedConcept?: string | null
  /** Definición o analogía del concepto relacionado */
  linkedDefinition?: string | null
}

export interface StudyDoubt {
  note: string
  bloque: number
  doubt: string
  /** Nombre del concepto relacionado (misma note+bloque) — enriquecido por backend */
  linkedConcept?: string | null
  /** Definición o analogía del concepto relacionado */
  linkedDefinition?: string | null
}

export type SelfScore = 'correct' | 'partial' | 'incorrect'

export interface ShadowSession {
  total: number
  results: Array<{
    id: string
    type: 'question' | 'doubt'
    text: string
    score: SelfScore
    concept: string | null
    timestamp: string
  }>
}

export interface StudyNote {
  name: string
  size: number
  modified: string
  bloques: number
  format?: string
  hasQuestions?: boolean
}

export interface StudyData {
  notes: StudyNote[]
  concepts: StudyConcept[]
  questions: StudyQuestion[]
  doubts: StudyDoubt[]
}

// --- Study History / Hashmap ---
export interface HistoryItem {
  file: string
  path: string
  fecha: string
  tipo: string
  score: string | null
  concepto: string | null
  pregunta: string
  hasAnswer: boolean
}

export interface StudyStats {
  total: number
  correct: number
  partial: number
  incorrect: number
  streak: number
  today: string
}

export interface StudyHistoryResponse {
  history: Record<string, HistoryItem[]>
  items: HistoryItem[]
  stats: StudyStats
}

// --- Market Data (Tendencias + Estrategia + Frases) ---
export interface MarketTrend {
  title: string
  detail: string
  source: string
  priority: string
}

export interface CEOQuote {
  quote: string
  person: string
  date: string
}

export interface StudyRecommendation {
  skill: string
  focus: string
  porque: string
}

export interface MarketData {
  trends: MarketTrend[]
  ceo_quotes: CEOQuote[]
  recommendations: StudyRecommendation[]
  motivational_phrases: string[]
  last_updated: string
}

// --- Anki ---
export interface AnkiDeckProgress {
  name: string
  total: number
  due: number
  studied: number
  pct: number
}

export interface AnkiStats {
  reviewed: number
  due: number
  total: number
  streak: number
  connected: boolean
  decks: AnkiDeckProgress[]
  history: Array<[string, number]>
}

// --- Active Recall Store v2 ---
export interface ActiveRecallReview {
  date: string
  answer: string | null
  score: SelfScore | null
  agentFeedback: string | null
  sessionId: string | null
}

export interface ActiveRecallQuestion {
  id: string
  question: string
  type: 'question' | 'doubt' | 'concept'
  concept: string | null
  definition: string | null
  sourceNote: string | null
  sourceBloque: number
  createdAt: string
  reviews: ActiveRecallReview[]
  interval: number
  nextReview: string | null
  due: boolean
}

export interface ActiveRecallDueItem {
  id: string
  question: string
  type: 'question' | 'doubt' | 'concept'
  concept: string | null
  definition: string | null
  sourceNote: string | null
  sourceBloque: number
  createdAt: string
  lastReview: ActiveRecallReview | null
  reviewCount: number
  lastScore: SelfScore | null
  interval: number
  nextReview: string
  due: boolean
}

export interface ActiveRecallDueResponse {
  questions: ActiveRecallDueItem[]
  stats: ActiveRecallStoreStats
}

export interface ActiveRecallStoreStats {
  totalQuestions: number
  totalReviews: number
  dueCount: number
  reviewedToday: number
  streak: number
  scores: {
    correct: number
    partial: number
    incorrect: number
  }
  lastUpdated: string
}

export interface ActiveRecallSubmitResponse {
  success: boolean
  id?: string
  review?: ActiveRecallReview
  interval?: number
  nextReview?: string
  due?: boolean
  error?: string
}

// --- Mastery Store / Skill Tree ---
export interface MasteryLevel {
  name: string
  color: string
  icon: string
  minScore: number
}

export interface ConceptMastery {
  id: string
  concept: string
  module: string | null
  currentScore: number
  level: number
  levelMeta: MasteryLevel
  totalScores: number
  correctCount: number
  lastValidated: string | null
}

export interface ConceptMasteryDetail extends ConceptMastery {
  scoreHistory: Array<{
    score: number
    scoreType: string
    sourceNote: string | null
    timestamp: string
    details: string | null
  }>
}

export interface SkillTreeModule {
  name: string
  concepts: ConceptMastery[]
  avgScore: number
  totalConcepts: number
  masteredCount: number
}

export interface CognitiveDebt {
  total_concepts: number
  validated: number
  consolidated: number
  debt_ratio: number
  by_module: Array<{
    module: string
    total: number
    validated: number
    consolidated: number
  }>
  burn_down_history: Array<{ date: string; remaining: number }>
  alert: string | null
}

export interface BiasAlert {
  type: 'automation' | 'illusion' | 'staleness'
  severity: 'low' | 'medium' | 'high'
  message: string
}

export interface BiasData {
  human_vs_ai_ratio: number
  illusion_of_competence: number
  staleness_index: number
  alerts: BiasAlert[]
  stale_concepts: Array<{ concept: string; lastValidated: string | null }>
}

export interface SocraticResult {
  score: number
  feedback: string
  strengths: string[]
  gaps: string[]
  challenge_question: string | null
  mastery: ConceptMastery
}

// --- NotebookLM Proxy ---
export interface NotebookLMHealth {
  authenticated: boolean
  sessions: number
  library_notebooks: number
  context_age_hours?: number
}

export interface NotebookLMNotebook {
  id: string
  name: string
  description: string
  url: string
  topics: string[]
  active?: boolean
  use_count?: number
}

export interface NotebookLMAskResponse {
  success: boolean
  data?: {
    status: string
    question: string
    answer: string
    session_id: string
    sources?: { format: string; citations: Array<{ marker: string; number: number; sourceText: string }> }
  }
}

// ─── Behavioral Tracking ──────────────────────────────────────────

export type BlockType = 'estudio' | 'descanso' | 'infra' | 'flex' | 'cierre' | 'unknown'

export interface DailySummary {
  date: string
  estudio_minutes: number
  infra_minutes: number
  descanso_minutes: number
  flex_minutes: number
  total_tool_calls: number
  block_violations: Array<{ expected: string; actual: string; timestamp: string }>
}

export interface WeeklySummary {
  days: DailySummary[]
}

export interface BlockAdherence {
  date: string
  adherence_pct: number
  total_minutes: number
  violations: number
  breakdown: Record<string, { actual: number; expected: number }>
  violation_details: Array<{ expected: string; actual: string; timestamp: string }>
}

export interface Streaks {
  current: number
  longest: number
  total_study_days: number
  last_study_date: string | null
}

export interface TimelineEntry {
  session_id: string
  started_at: string
  ended_at: string | null
  block_type: BlockType
  duration_minutes: number
  activity_count: number
}

export interface Timeline {
  date: string
  sessions: TimelineEntry[]
}

export interface CurrentBlock {
  block: BlockType
  hour: number
}

// ───── Todos + Vault Metrics (TODO seq 1517) ─────

export type TodoState = 'backlog' | 'todo' | 'in-progress' | 'review' | 'blocked' | 'done' | 'cancelled'

export interface TodoItem {
  id: string
  title: string
  state: TodoState
  priority: string
  updated: string | null
  /**
   * Phase 4 write-back: 0-based line index of the item's `##` heading inside
   * `_PENDING.md` — the stable toggle target when duplicate titles exist.
   */
  line?: number
}

// Phase 4 write-back: the toggle response integrates the refreshed item so
// the row can update in place (the markdown SSOT is re-read server-side).
export interface TodoToggleResponse {
  ok: boolean
  item: TodoItem
  sources?: SourceFile[]
  /** The marker that flipped. `mode`: checkbox bracket vs Estado value. */
  toggled?: { from: string; to: string; mode: 'checkbox' | 'estado' }
  error?: string
}

export interface TodosResponse {
  total: number
  active: TodoItem[]
  counts: Record<TodoState, number>
  sources?: SourceFile[]
  timestamp: string
}

export interface TodosMetrics {
  exceptions: {
    total: number
    by_status: { fail: number; warn: number; registered: number }
    top_gates: Array<{ gate: string; count: number }>
  }
  sessions: { total: number; last: string | null }
  operational: { total: number; last: unknown }
  timestamp: string
}

export interface TodosGraph {
  mermaid: string
  nodes: Array<{ id: string; label: string; files: number; md_notes: number; total_files: number }>
  orphan_count: number | null
  broken_count: number | null
  timestamp: string
}

// --- Phase 5: Vault Doctor (schema lint per directory + runtime diagnostics) ---

export type VaultDoctorSeverity = 'error' | 'warn'

export type VaultDoctorKind =
  | 'missing_field'
  | 'bad_date'
  | 'suspicious_price'
  | 'bad_quantity'
  | 'bad_slot_format'
  | 'suspicious_value'
  | 'bad_entry'
  | 'unreadable_file'
  | 'duplicate_day'

/**
 * One finding the tolerant parser would silently skip. `file` is a
 * vault-relative path ('/'-separated); `obsidian_url` is the Phase 1
 * deep-link (`obsidian://open?path=<absolute fs path>`).
 * NOTE: `line` here is 1-based (human/editor line), unlike TodoItem's
 * 0-based heading index.
 */
export interface VaultDoctorFinding {
  file: string
  line?: number
  kind: VaultDoctorKind
  severity: VaultDoctorSeverity
  field?: string
  value?: string
  message: string
  obsidian_url?: string
}

export interface VaultDoctorResponse {
  ok: boolean
  /** Files linted per zone (only files in expected zones are counted). */
  scanned: { compras: number; food_sora: number; assets: number; wallet: number }
  findings: VaultDoctorFinding[]
  /** Runtime per-source status from the DB loader + watcher (getInitDiagnostics). */
  diagnostics: {
    initialized: boolean
    initFailed: boolean
    sources: Record<string, string>
  }
}
