import { useState } from 'react'
import FinanzasDashboard from './FinanzasDashboard'
import PatrimonioDashboard from './PatrimonioDashboard'
import ComprasDashboard from './ComprasDashboard'
import FoodSoraDashboard from './FoodSoraDashboard'

type FinanzasTab = 'resumen' | 'patrimonio' | 'compras' | 'food-sora'

const tabs: { id: FinanzasTab; label: string; icon: string }[] = [
  { id: 'resumen',    label: 'Resumen',    icon: '📊' },
  { id: 'patrimonio', label: 'Patrimonio', icon: '🏦' },
  { id: 'compras',    label: 'Compras',    icon: '🛒' },
  { id: 'food-sora',  label: 'Comedero',  icon: '🐱' },
]

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function FinanzasWrapper() {
  const [subTab, setSubTab] = useState<FinanzasTab>('resumen')

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-[rgba(15,11,15,0.3)] rounded-[12px] border border-[rgba(232,184,75,0.06)] w-fit max-lg:w-full max-lg:overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-[0.5rem] rounded-[8px] text-sm font-medium transition-all duration-150 whitespace-nowrap ${
              subTab === t.id
                ? 'bg-card text-accent shadow-sm border border-[rgba(232,184,75,0.1)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-[rgba(240,229,216,0.04)]'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'resumen' && <FinanzasDashboard />}
      {subTab === 'patrimonio' && <PatrimonioDashboard />}
      {subTab === 'compras' && <ComprasDashboard month={getCurrentMonth()} />}
      {subTab === 'food-sora' && <FoodSoraDashboard />}
    </div>
  )
}
