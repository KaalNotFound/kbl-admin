import { create } from 'zustand'

type Tab =
  | 'overview' | 'integrations' | 'inventory' | 'queue' | 'projects'
  | 'entities' | 'logs' | 'context'
  | 'study' | 'market' | 'finanzas' | 'behavioral'
  | 'todos'
  | 'algorithms'
  | 'doctor'

type FocusMode = 'full' | 'focused' | 'immersive'

interface AppState {
  tab: Tab
  search: string
  theme: 'dark' | 'light'
  focusMode: FocusMode
  sidebarCollapsed: boolean
  setTab: (tab: Tab) => void
  setSearch: (search: string) => void
  toggleTheme: () => void
  setFocusMode: (mode: FocusMode) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  tab: 'overview',
  search: '',
  theme: (() => {
    const saved = localStorage.getItem('kbl-theme')
    return saved ? (saved === 'dark' ? 'dark' : 'light') : 'light'
  })(),
  focusMode: 'full',
  sidebarCollapsed: false,

  setTab: (tab) => set({ tab }),
  setSearch: (search) => set({ search }),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('kbl-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    }),
  setFocusMode: (focusMode) => set({ focusMode }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

// Initialize theme on load
const initial = useAppStore.getState()
document.documentElement.setAttribute('data-theme', initial.theme)
