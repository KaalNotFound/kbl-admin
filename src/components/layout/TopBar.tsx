import { useAppStore } from '../../stores/app-store'
import { pageMeta } from './page-meta'

export default function TopBar() {
  const { tab, search, setSearch } = useAppStore()
  const meta = pageMeta[tab]

  return (
    <header className="sticky top-0 z-10 bg-page/80 backdrop-blur-md border-b border-border-light">
      <div className="flex items-center justify-between px-8 py-4 max-lg:px-4 max-lg:py-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-text-tertiary max-lg:hidden">
          <span>KBL Admin</span>
          <span>/</span>
          <span className="text-text-secondary font-medium">{meta.title}</span>
        </div>

        {/* Search + sync indicator */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="relative max-lg:hidden">
            <input
              type="search"
              placeholder="Buscar...  Ctrl+K"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-56 pl-3 pr-8 py-1.5 text-xs bg-card border border-border-light rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs">⌕</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
            <span className="max-lg:hidden">en vivo</span>
          </div>
        </div>
      </div>
    </header>
  )
}
