import { useState, useRef, useEffect } from 'react'
import { fetchEntityCatalog, sendCapture } from '../api'
import type { CaptureFields, CaptureResponse } from '../api/vault'
import type { EntityCatalogEntry } from '../types'
import { handleDialogKeyDown } from './ui/dialogKeyboard'

// Builtin quick types: garantizan que compra/food SIEMPRE existan en el
// selector (el catálogo del vault es dinámico y puede no traerlos), así la
// captura triageada del demo funciona en cualquier vault.
const BUILTIN_TYPES: EntityCatalogEntry[] = [
  { id: 'compra', name: 'Compra', description: 'Ticket → 02 - AREAS/…/Compras (watcher)' },
  { id: 'food', name: 'Food Slot', description: 'Slot diario → 05 - JOURNAL/Daily' },
]

const SLOT_OPTIONS: { value: string; label: string }[] = [
  { value: 'madrugada', label: 'Madrugada' },
  { value: 'manana', label: 'Mañana' },
  { value: 'mediodia', label: 'Mediodía' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
]

function nowHM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
function firstLine(text: string): string {
  return text.split('\n').map(l => l.trim()).find(Boolean) || ''
}

export default function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<CaptureResponse & { label: string } | null>(null)
  const [entityTypes, setEntityTypes] = useState<EntityCatalogEntry[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // APG dialog: when the modal closes (any path), focus returns to the opener.
  useEffect(() => {
    if (!open && wasOpen.current) openerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  // Structured fields per type (phase 3 triage)
  const [comercio, setComercio] = useState('')
  const [precio, setPrecio] = useState('')
  const [categoria, setCategoria] = useState('')
  const [slot, setSlot] = useState('manana')
  const [hora, setHora] = useState(nowHM())
  const [captureDate, setCaptureDate] = useState(todayISO())

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
    if (open && !catalogLoaded) {
      fetchEntityCatalog()
        .then(types => { setEntityTypes(types); setCatalogLoaded(true) })
        .catch(() => {})
    }
  }, [open, catalogLoaded])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const resetExtras = () => {
    setComercio('')
    setPrecio('')
    setCategoria('')
    setSlot('manana')
    setHora(nowHM())
    setCaptureDate(todayISO())
  }

  const closeAll = () => {
    setOpen(false)
    setContent('')
    setSelectedType('')
    resetExtras()
  }

  const handleTypeSelected = (id: string) => {
    setSelectedType(id)
    setShowDropdown(false)
    resetExtras()
  }

  const buildPayload = (): { fields?: CaptureFields; date?: string } | null => {
    if (selectedType === 'compra') {
      // Comercio es el campo requerido (nomina el archivo del ticket); el
      // precio viaja RAW ('42,75') — el parseo es del lado del servidor.
      if (!comercio.trim()) return null
      const fields: CaptureFields = { comercio: comercio.trim(), precio_total: precio.trim(), categoria: categoria.trim() }
      const prod = firstLine(content)
      if (prod) fields.producto = prod
      return { fields }
    }
    if (selectedType === 'food') {
      return {
        fields: { slot, hora },
        date: captureDate || undefined,
      }
    }
    return {}
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    const payload = buildPayload()
    if (payload === null) return // compra sin comercio → no cruza el umbral
    setSending(true)
    try {
      const res = await sendCapture(content, 'quick-capture', selectedType || undefined, payload.fields, payload.date)
      setDone({ ...res, label: typeLabel(selectedType) })
      setTimeout(() => {
        setOpen(false)
        setContent('')
        setSelectedType('')
        resetExtras()
        setDone(null)
      }, 2600)
    } catch {
      alert('Error al guardar la nota')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (content.trim() && !(selectedType === 'compra' && !comercio.trim())) handleSubmit()
    }
  }

  const typeLabel = (id: string): string => {
    if (id === 'compra') return 'Compra'
    if (id === 'food') return 'Food slot'
    const entry = mergedTypes().find(t => t.id === id)
    return entry ? entry.name : 'Nota'
  }

  const mergedTypes = (): EntityCatalogEntry[] => {
    const map = new Map<string, EntityCatalogEntry>()
    for (const t of BUILTIN_TYPES) map.set(t.id, t)
    for (const t of entityTypes) if (!map.has(t.id)) map.set(t.id, t)
    return [...map.values()]
  }

  const selectedEntry = mergedTypes().find(t => t.id === selectedType)

  // Dynamic destination copy — what the footer claims is now what really happens
  const destFolder = selectedType === 'compra'
    ? '02 - AREAS/008 - Trazabilidad Compras/Compras/'
    : selectedType === 'food'
      ? '05 - JOURNAL/Daily/'
      : '00 - INBOX/'

  const isCompra = selectedType === 'compra'
  const isFood = selectedType === 'food'

  return (
    <>
      {/* FAB */}
      <button
        ref={openerRef}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-accent text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center text-xl"
        title="Captura rápida (N)"
        aria-label="Captura rápida"
      >
        ✦
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={closeAll} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-capture-title"
            onKeyDown={e => handleDialogKeyDown(e, { onClose: closeAll })}
            className="relative bg-card rounded-2xl shadow-xl border border-border-light w-full max-w-lg p-5 animate-fade-in"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 id="quick-capture-title" className="text-sm font-semibold text-text-primary">Captura rápida</h3>
              <button
                onClick={closeAll}
                aria-label="Cerrar"
                className="text-text-tertiary hover:text-text-primary transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Entity type selector */}
            <div className="relative mb-3" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-lg border transition-all
                  ${selectedType
                    ? 'bg-accent-light/30 border-accent/30 text-accent'
                    : 'bg-page border-border-light text-text-tertiary hover:text-text-secondary'
                  }`}
              >
                <span className="opacity-60">⊡</span>
                <span className="flex-1 text-left truncate">
                  {selectedEntry ? selectedEntry.name : 'Sin clasificar'}
                </span>
                <span className="opacity-40">{showDropdown ? '▲' : '▼'}</span>
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border-light rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto">
                  <button
                    onClick={() => handleTypeSelected('')}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface flex items-center gap-2
                      ${!selectedType ? 'text-accent font-medium bg-accent-light/20' : 'text-text-secondary'}`}
                  >
                    <span>⊡</span>
                    <span>Sin clasificar</span>
                    <span className="text-text-tertiary ml-auto">(lo clasifica el pipeline)</span>
                  </button>

                  <div className="border-t border-border-light mx-2" />

                  {mergedTypes().map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTypeSelected(t.id)}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface flex items-center gap-2
                        ${selectedType === t.id ? 'text-accent font-medium bg-accent-light/20' : 'text-text-secondary'}`}
                      title={t.description}
                    >
                      <span>⊡</span>
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">{t.name}</span>
                        {t.description && (
                          <span className="text-[0.55rem] text-text-tertiary truncate block">{t.description}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Structured fields — compra (ticket triage) */}
            {isCompra && (
              <div className="grid grid-cols-[1fr_0.5fr_0.6fr] gap-2 mb-3">
                <label htmlFor="qc-comercio" className="sr-only">Comercio</label>
                <input
                  id="qc-comercio"
                  value={comercio}
                  onChange={e => setComercio(e.target.value)}
                  placeholder="Comercio (requerido)"
                  className="bg-page border border-border-light rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-all"
                />
                <label htmlFor="qc-precio" className="sr-only">Precio</label>
                <input
                  id="qc-precio"
                  value={precio}
                  onChange={e => setPrecio(e.target.value)}
                  placeholder="Precio (42,75)"
                  inputMode="decimal"
                  className="bg-page border border-border-light rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-all [font-variant-numeric:tabular-nums]"
                />
                <label htmlFor="qc-categoria" className="sr-only">Categoría</label>
                <input
                  id="qc-categoria"
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  placeholder="Categoría (opcional)"
                  className="bg-page border border-border-light rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-all"
                />
              </div>
            )}

            {/* Structured fields — food (Daily slot upsert) */}
            {isFood && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <label htmlFor="qc-slot" className="sr-only">Franja</label>
                <select
                  id="qc-slot"
                  value={slot}
                  onChange={e => setSlot(e.target.value)}
                  className="bg-page border border-border-light rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent transition-all"
                >
                  {SLOT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <label htmlFor="qc-hora" className="sr-only">Hora</label>
                <input
                  id="qc-hora"
                  type="time"
                  aria-label="Hora"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="bg-page border border-border-light rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent transition-all [font-variant-numeric:tabular-nums]"
                />
                <label htmlFor="qc-fecha" className="sr-only">Fecha</label>
                <input
                  id="qc-fecha"
                  type="date"
                  aria-label="Fecha"
                  value={captureDate}
                  onChange={e => setCaptureDate(e.target.value)}
                  className="bg-page border border-border-light rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent transition-all [font-variant-numeric:tabular-nums]"
                />
              </div>
            )}

            <textarea
              ref={inputRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isCompra
                  ? '¿Qué compraste? (primera línea = producto; ⌘+Enter para guardar)'
                  : 'Escribí tu nota acá... (⌘+Enter para guardar)'
              }
              rows={4}
              className="w-full resize-none bg-page border border-border-light rounded-xl p-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(43,92,138,0.08)] transition-all"
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-[0.65rem] text-text-tertiary">
                {selectedType
                  ? <>Se guarda como <code className="text-accent">{selectedType}</code> en <code className="text-accent">{destFolder}</code></>
                  : <>Se guarda en <code className="text-accent">{destFolder}</code> sin clasificar</>
                }
              </span>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || sending || (isCompra && !comercio.trim())}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  sending
                    ? 'bg-accent text-white opacity-60 cursor-wait'
                    : 'bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {sending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            {/* Feedback + provenance deep link (replaces the plain "✓ Guardado") */}
            {done && (
              <div className="mt-3 flex items-center gap-2 flex-wrap px-1 py-2 rounded-lg bg-success/10">
                <span className="text-xs font-medium text-text-primary">
                  ✓ {done.label} guardado en <code className="text-accent break-all">{done.path}</code>
                </span>
                {done.obsidian_url && (
                  <a
                    href={done.obsidian_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir la nota en Obsidian"
                    className="inline-flex items-center gap-1 text-[0.65rem] text-[#a0907e] border border-[rgba(232,184,75,0.15)] rounded-[4px] px-[0.4rem] py-[0.1rem] hover:text-kbl-blue hover:border-[rgba(232,184,75,0.35)] hover:bg-[rgba(232,184,75,0.06)] transition-colors"
                  >
                    Abrir en Obsidian ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
