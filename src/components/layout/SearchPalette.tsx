import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { fetchGlobalSearch } from '../../api'
import type { GlobalSearchItem, GlobalSearchGroup } from '../../api/search'

function flatItems(groups: GlobalSearchGroup[]): GlobalSearchItem[] {
  return groups.flatMap((g) => g.items)
}

/**
 * SearchPalette — dropdown for the TopBar "Buscar... Ctrl+K" input.
 *
 * Debounced fetch of GET /api/global-search; keyboard navigation
 * (↑/↓ move, Enter navigates to the item's dashboard, Esc closes).
 * Clicking a result navigates via useAppStore.setTab(item.tab).
 */
export default function SearchPalette() {
  const { search, setSearch, setTab } = useAppStore()
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const debounceRef = useRef<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setGroups([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      fetchGlobalSearch(q)
        .then((r) => {
          setGroups(r.groups)
          setOpen(true)
          setCursor(-1)
        })
        .catch(() => setGroups([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => { window.clearTimeout(debounceRef.current) }
  }, [search])

  // Ctrl+K focuses the search input (the placeholder promises it)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const items = flatItems(groups)

  function navigate(item: GlobalSearchItem) {
    setTab(item.tab as Parameters<typeof setTab>[0])
    setSearch('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (cursor >= 0 && items[cursor]) navigate(items[cursor])
      else if (items[0]) navigate(items[0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  let flatIndex = -1

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="search"
        placeholder="Buscar...  Ctrl+K"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => { if (search.trim().length >= 2) setOpen(true) }}
        onKeyDown={onKeyDown}
        className="w-56 pl-3 pr-8 py-1.5 text-xs bg-card border border-border-light rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs pointer-events-none">
        {loading ? '⟳' : '⌕'}
      </span>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-96 max-lg:w-[85vw] bg-card border border-border-light rounded-xl shadow-xl max-h-[70vh] overflow-y-auto z-50">
          {items.length === 0 ? (
            <div className="px-4 py-3 text-xs text-text-secondary">
              {loading ? 'Buscando…' : `Sin resultados para "${search.trim()}"`}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.type} className="py-1">
                <div className="px-4 pt-1.5 pb-1 text-[0.65rem] font-semibold text-text-tertiary uppercase tracking-wider">
                  {g.label}
                </div>
                {g.items.map((item) => {
                  flatIndex += 1
                  const idx = flatIndex
                  const active = idx === cursor
                  return (
                    <button
                      key={`${g.type}-${item.title}-${idx}`}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setCursor(idx)}
                      className={`w-full text-left px-4 py-2 flex items-start gap-2.5 transition-colors ${
                        active ? 'bg-accent/10' : 'hover:bg-hover'
                      }`}
                    >
                      <span className="mt-px shrink-0 text-[0.6rem] px-1.5 py-0.5 rounded bg-hover text-text-secondary">
                        {item.kind || g.label}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-text-primary truncate">
                          {item.title}
                        </span>
                        {(item.meta || item.snippet || item.path) && (
                          <span className="block text-[0.65rem] text-text-tertiary truncate">
                            {(item.meta || item.snippet || item.path)?.slice(0, 90)}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
