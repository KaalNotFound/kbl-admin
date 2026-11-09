import { useState, useEffect, useRef } from 'react'
import { fetchInventory, createInventoryItem } from '../api'
import type { InventoryCategory, InventoryItem, InventoryResponse } from '../types'
import { INVENTORY_CATEGORIES } from '../types'
import { handleDialogKeyDown } from './ui/dialogKeyboard'

export default function InventoryDashboard() {
  const [data, setData] = useState<InventoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<InventoryCategory | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'otros', quantity: 1, unit: 'unidades', min_stock: 1, expiry: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const openerRef = useRef<HTMLButtonElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const wasOpen = useRef(false)

  const loadInventory = () => {
    fetchInventory()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadInventory() }, [])

  const closeForm = () => {
    setShowForm(false)
    setFormError('')
  }

  // APG dialog: first field focus on open; focus returns to the opener on close.
  useEffect(() => {
    if (showForm) nameInputRef.current?.focus()
    if (!showForm && wasOpen.current) openerRef.current?.focus()
    wasOpen.current = showForm
  }, [showForm])

  const catLookup: Record<string, string> = {}
  for (const c of INVENTORY_CATEGORIES) catLookup[c.id] = c.label

  const handleCreate = async () => {
    setFormError('')
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const res = await createInventoryItem(form)
      if (res.success) {
        setShowForm(false)
        setForm({ name: '', category: 'otros', quantity: 1, unit: 'unidades', min_stock: 1, expiry: '', notes: '' })
        loadInventory()
      } else {
        setFormError(res.error || 'Error al crear item')
      }
    } catch (e: any) {
      setFormError(e.message || 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const items = data?.items || []
  const summary = data?.summary || null

  const filtered = items.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const now = Date.now()
  const SEVEN_DAYS = 7 * 86400000

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Items Totales</h3>
          <p className="text-3xl font-bold text-accent mt-1">
            {loading ? '...' : summary?.total_items ?? 0}
          </p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">en todas las categorias</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Stock Bajo</h3>
          <p className={`text-3xl font-bold mt-1 ${(summary?.low_stock_items ?? 0) > 0 ? 'text-danger' : 'text-accent'}`}>
            {loading ? '...' : summary?.low_stock_items ?? 0}
          </p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">necesitan reposicion</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Por Vencer</h3>
          <p className={`text-3xl font-bold mt-1 ${(summary?.expiring_soon ?? 0) > 0 ? 'text-warning' : 'text-accent'}`}>
            {loading ? '...' : summary?.expiring_soon ?? 0}
          </p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">en los proximos 7 dias</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Categorias</h3>
          <p className="text-3xl font-bold text-accent mt-1">
            {loading ? '...' : Object.keys(summary?.categories || {}).filter(c => (summary?.categories as any)?.[c]?.count > 0).length}
          </p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">con items registrados</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <CategoryTab
          label="Todas"
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        />
        {INVENTORY_CATEGORIES.map(cat => (
          <CategoryTab
            key={cat.id}
            label={cat.label}
            active={activeCategory === cat.id}
            count={summary ? (summary.categories as any)[cat.id]?.count : 0}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 bg-card border border-border-light rounded-xl text-sm text-text-primary placeholder-[#706050] focus:outline-none focus:border-accent/30 transition-colors"
        />
      </div>

      {/* Inventory Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-border-light flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            {activeCategory === 'all' ? 'Todos los Items' : catLookup[activeCategory] || 'Items'}
            <span className="ml-2 text-xs text-text-tertiary font-normal">({filtered.length})</span>
          </h3>
        </div>

        {/* Column Headers */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-[0.65rem] text-text-tertiary uppercase tracking-wider font-semibold border-b border-border-light">
          <span className="col-span-3">Item</span>
          <span className="col-span-2">Cantidad</span>
          <span className="col-span-2">Stock Min</span>
          <span className="col-span-2">Vence</span>
          <span className="col-span-3">Categoria</span>
        </div>

        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState summary={summary} />
        ) : (
          <div className="divide-y divide-border-light">
            {filtered.map(item => {
              const isLow = item.quantity <= item.min_stock
              const expDate = item.expiry ? new Date(item.expiry).getTime() : null
              const isExpiring = expDate && !isNaN(expDate) && (expDate - now) < SEVEN_DAYS && expDate > now
              const isExpired = expDate && expDate < now

              return (
                <div key={item.id} className="grid grid-cols-12 gap-3 px-5 py-3 text-sm hover:bg-surface transition-colors items-center">
                  <span className="col-span-3 text-text-primary font-medium truncate" title={item.name}>
                    {isLow && <span className="text-danger mr-1" title="Stock bajo">!</span>}
                    {isExpiring && <span className="text-warning mr-1" title="Por vencer">~</span>}
                    {isExpired && <span className="text-danger mr-1" title="Vencido">x</span>}
                    {item.name}
                  </span>
                  <span className={`col-span-2 font-mono ${isLow ? 'text-danger font-semibold' : 'text-text-primary'}`}>
                    {item.quantity} {item.unit}
                  </span>
                  <span className="col-span-2 text-text-tertiary font-mono text-xs">
                    {item.min_stock} {item.unit}
                  </span>
                  <span className={`col-span-2 font-mono text-xs ${isExpired ? 'text-danger' : isExpiring ? 'text-warning' : 'text-text-tertiary'}`}>
                    {item.expiry || '-'}
                  </span>
                  <span className="col-span-3 text-xs text-text-tertiary">
                    {catLookup[item.category] || item.category}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">Acciones</h3>
        <div className="flex flex-wrap gap-3">
          <button
            ref={openerRef}
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            + Agregar Item
          </button>
          <button disabled className="px-4 py-2 text-xs font-medium rounded-lg bg-surface text-text-tertiary border border-border-light cursor-not-allowed">
            Generar Lista de Compras
          </button>
        </div>
      </div>

      {/* Add Item Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={closeForm} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-form-title"
            onKeyDown={e => handleDialogKeyDown(e, { onClose: closeForm })}
            className="relative bg-card rounded-2xl shadow-xl border border-border-light w-full max-w-lg p-5 animate-fade-in"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="inventory-form-title" className="text-sm font-semibold text-text-primary">Agregar Item</h3>
              <button
                onClick={closeForm}
                aria-label="Cerrar"
                className="text-text-tertiary hover:text-text-primary transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20">
                <p className="text-xs text-danger">{formError}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="inv-name" className="block text-xs text-text-secondary mb-1">Nombre *</label>
                <input
                  id="inv-name"
                  ref={nameInputRef}
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-page border border-border-light rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/30"
                  placeholder="Ej: Arroz"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Categoría *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-page border border-border-light rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/30"
                  >
                    {INVENTORY_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Unidad</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-page border border-border-light rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/30"
                  >
                    <option value="unidades">unidades</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="paquete">paquete</option>
                    <option value="latas">latas</option>
                    <option value="botellas">botellas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full px-3 py-2 bg-page border border-border-light rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    min="1"
                    value={form.min_stock}
                    onChange={e => setForm({ ...form, min_stock: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-3 py-2 bg-page border border-border-light rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Vencimiento</label>
                <input
                  type="date"
                  value={form.expiry}
                  onChange={e => setForm({ ...form, expiry: e.target.value })}
                  className="w-full px-3 py-2 bg-page border border-border-light rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/30"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-page border border-border-light rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/30 resize-none"
                  placeholder="Notas opcionales..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-border-light">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-surface text-text-secondary hover:bg-border-light transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-5 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Crear Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryTab({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
        active
          ? 'bg-accent-light text-accent border border-accent/20'
          : 'bg-surface text-text-secondary border border-transparent hover:bg-surface'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[0.6rem] px-1.5 py-0.5 rounded-full ${
          active ? 'bg-accent/20 text-accent' : 'bg-surface text-text-tertiary'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

function LoadingState() {
  return (
    <div className="py-16 text-center">
      <div className="animate-pulse space-y-3 max-w-xs mx-auto">
        <div className="h-3 bg-surface rounded" />
        <div className="h-3 bg-surface rounded w-3/4 mx-auto" />
        <div className="h-3 bg-surface rounded w-1/2 mx-auto" />
      </div>
      <p className="text-sm text-text-tertiary mt-4">Escaneando vault...</p>
    </div>
  )
}

function EmptyState({ summary }: { summary: InventoryResponse['summary'] | null }) {
  return (
    <div className="py-16 text-center">
      <div className="text-2xl text-text-tertiary mb-3">◻</div>
      <p className="text-sm text-text-tertiary mb-1">No hay items de inventario</p>
      <p className="text-xs text-text-tertiary max-w-sm mx-auto leading-relaxed">
        Crea notas con inline field <code className="text-accent">entity_type:: inventory_item</code>
        <br />
        y los campos: <code className="text-text-tertiary">name</code>, <code className="text-text-tertiary">category</code>, <code className="text-text-tertiary">quantity</code>, <code className="text-text-tertiary">min_stock</code>, <code className="text-text-tertiary">expiry</code>
      </p>
      {summary && (
        <div className="mt-6 space-y-1 text-xs text-text-tertiary">
          <p>Categorias disponibles: {
            Object.entries(summary.categories || {})
              .filter(([_, v]) => (v as any).count > 0)
              .map(([k]) => k)
              .join(', ') || 'ninguna'
          }</p>
        </div>
      )}
    </div>
  )
}
