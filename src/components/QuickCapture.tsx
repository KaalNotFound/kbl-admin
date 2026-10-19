import { useState, useRef, useEffect } from 'react'
import { fetchEntityCatalog, sendCapture } from '../api'
import type { EntityCatalogEntry } from '../types'

export default function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [entityTypes, setEntityTypes] = useState<EntityCatalogEntry[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSending(true)
    try {
      await sendCapture(content, 'quick-capture', selectedType || undefined)
      setDone(true)
      setTimeout(() => {
        setOpen(false)
        setContent('')
        setSelectedType('')
        setDone(false)
      }, 1200)
    } catch {
      alert('Error al guardar la nota')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setContent('')
      setSelectedType('')
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (content.trim()) handleSubmit()
    }
  }

  const selectedEntry = entityTypes.find(t => t.id === selectedType)

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-accent text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center text-xl"
        title="Captura rápida (N)"
      >
        ✦
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => { setOpen(false); setContent(''); setSelectedType('') }} />
          <div className="relative bg-card rounded-2xl shadow-xl border border-border-light w-full max-w-lg p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Captura rápida</h3>
              <button
                onClick={() => { setOpen(false); setContent(''); setSelectedType('') }}
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
                    onClick={() => { setSelectedType(''); setShowDropdown(false) }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface flex items-center gap-2
                      ${!selectedType ? 'text-accent font-medium bg-accent-light/20' : 'text-text-secondary'}`}
                  >
                    <span>⊡</span>
                    <span>Sin clasificar</span>
                    <span className="text-text-tertiary ml-auto">(lo clasifica el pipeline)</span>
                  </button>

                  <div className="border-t border-border-light mx-2" />

                  {entityTypes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedType(t.id); setShowDropdown(false) }}
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

            <textarea
              ref={inputRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu nota acá... (⌘+Enter para guardar)"
              rows={4}
              className="w-full resize-none bg-page border border-border-light rounded-xl p-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(43,92,138,0.08)] transition-all"
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-[0.65rem] text-text-tertiary">
                {selectedType
                  ? <>Se guarda como <code className="text-accent">{selectedType}</code> en <code className="text-accent">00 - INBOX/</code></>
                  : <>Se guarda en <code className="text-accent">00 - INBOX/</code> sin clasificar</>
                }
              </span>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || sending}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  done
                    ? 'bg-success text-white'
                    : 'bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {done ? '✓ Guardado' : sending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
