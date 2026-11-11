import { useAppStore } from '../../stores/app-store'

type Tab =
  | 'overview' | 'integrations' | 'inventory' | 'queue' | 'projects'
  | 'entities' | 'logs' | 'context'
  | 'study' | 'market' | 'finanzas' | 'behavioral'
  | 'todos'
  | 'algorithms'
  | 'doctor'

interface TabDef {
  id: Tab
  label: string
  icon: string
  group: string
}

const tabs: TabDef[] = [
  { id: 'overview',     label: 'Visión General',  icon: '◉', group: 'Visión' },
  { id: 'context',      label: 'Contexto Sesión',  icon: '📋', group: 'Visión' },
  { id: 'todos',        label: 'TODO & Métricas',  icon: '☑', group: 'Visión' },
  { id: 'integrations', label: 'Integraciones',    icon: '🔗', group: 'Módulos' },
  { id: 'finanzas',     label: 'Finanzas',         icon: '💰', group: 'Módulos' },
  { id: 'study',        label: 'Estudio',          icon: '📖', group: 'Módulos' },
  { id: 'algorithms',   label: 'Algoritmos',       icon: '⚙', group: 'Módulos' },
  { id: 'behavioral',   label: 'Conducta',         icon: '🧠', group: 'Módulos' },
  { id: 'market',       label: 'Mercado',          icon: '📊', group: 'Módulos' },
  { id: 'inventory',    label: 'Inventario',       icon: '◻', group: 'Módulos' },
  { id: 'queue',        label: 'Pipeline',         icon: '⇶', group: 'Flujo' },
  { id: 'projects',     label: 'Proyectos',        icon: '⊞', group: 'Flujo' },
  { id: 'entities',     label: 'Entity Types',     icon: '⊡', group: 'Flujo' },
  { id: 'logs',         label: 'Registros',        icon: '☰', group: 'Sistema' },
  { id: 'doctor',       label: 'Vault Doctor',     icon: '🩺', group: 'Referencia' },
]

const groups = ['Visión', 'Módulos', 'Flujo', 'Referencia', 'Sistema'] as const

export default function Sidebar() {
  const { tab, setTab, theme, toggleTheme } = useAppStore()

  return (
    <aside className="sidebar fixed top-0 left-0 bottom-0 w-[240px] flex flex-col z-10 bg-card max-lg:w-14 max-lg:items-center">
      {/* Logo */}
      <div className="px-6 pt-6 pb-5 border-b border-border-light max-lg:px-3 max-lg:pt-4 max-lg:pb-3 max-lg:flex max-lg:justify-center">
        <div className="text-[1.4rem] font-bold tracking-tight text-gradient-logo">KBL</div>
        <p className="text-[0.6rem] text-text-secondary uppercase tracking-widest mt-0.5 max-lg:hidden">panel de administración</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto max-lg:px-1">
        {groups.map(group => {
          const groupTabs = tabs.filter(t => t.group === group)
          if (groupTabs.length === 0) return null
          return (
            <div key={group}>
              <p className="px-3 mb-1 text-[0.6rem] font-semibold text-text-tertiary uppercase tracking-widest max-lg:hidden">
                {group}
              </p>
              <div className="space-y-0.5">
                {groupTabs.map(t => (
                  <button
                    key={t.id}
                    className={`flex items-center gap-3 w-full px-3 py-[0.55rem] rounded-lg text-sm transition-all duration-150 max-lg:justify-center max-lg:px-2 max-lg:py-2
                      ${tab === t.id
                        ? 'bg-accent-light text-accent font-semibold'
                        : 'text-text-secondary font-medium hover:bg-surface hover:text-text-primary'
                      }`}
                    onClick={() => setTab(t.id)}
                  >
                    <span className={`${tab === t.id ? 'opacity-100' : 'opacity-60'}`}>{t.icon}</span>
                    <span className="max-lg:hidden">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border-light max-lg:hidden space-y-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 w-full px-3 py-[0.55rem] rounded-lg text-sm transition-all duration-150 text-text-secondary font-medium hover:bg-surface hover:text-text-primary"
        >
          <span className="text-xs">{theme === 'dark' ? '☀' : '☾'}</span>
          <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
        </button>
        <p className="px-3 text-[0.65rem] text-text-tertiary">v1.0 · KBL System</p>
      </div>
    </aside>
  )
}

export { tabs, groups }
export type { Tab, TabDef }
