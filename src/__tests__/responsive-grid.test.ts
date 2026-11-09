// Responsive floor guards (issue #4 C3). These are DOM-structure/CSS-only
// fixes (grid floors + scrollable tables), so this is a cheap source-level
// snapshot: assert every spot keeps its mobile floor instead of rendering
// heavy dashboards with stubbed fetches.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = (p: string) =>
  readFileSync(fileURLToPath(new URL('../../' + p, import.meta.url)), 'utf-8')

describe('mobile grid floors + scrollable tables (issue #4 C3)', () => {
  it('every listed grid spot has a mobile floor (grid-cols-2 or 1) before its sm:/md: step-up', () => {
    const spots: [string, string][] = [
      ['src/components/StudyHashmap.tsx', 'grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6'],
      ['src/components/TodosDashboard.tsx', 'grid grid-cols-2 sm:grid-cols-4 gap-4'],
      ['src/components/SystemLogs.tsx', 'grid grid-cols-2 sm:grid-cols-3 gap-4'],
      ['src/components/Integrations.tsx', 'grid grid-cols-2 sm:grid-cols-4 gap-4'],
      ['src/components/CognitiveDebt.tsx', 'grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6'],
      ['src/components/SocraticAudit.tsx', 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'],
      ['src/components/BiasRadar.tsx', 'grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4'],
      ['src/components/EntityTypesDashboard.tsx', 'grid grid-cols-2 sm:grid-cols-3 gap-4'],
      ['src/components/QueueDashboard.tsx', 'grid grid-cols-2 sm:grid-cols-3 gap-4'],
      ['src/components/ProjectsDashboard.tsx', 'grid grid-cols-2 sm:grid-cols-3 gap-4'],
    ]
    for (const [file, floor] of spots) {
      expect([file, src(file).includes(floor)]).toEqual([file, true])
    }
  })

  it('StudyDashboard notes table scrolls horizontally instead of clipping', () => {
    // The wrapper div immediately before the notes <table> must scroll.
    const table = src('src/components/StudyDashboard.tsx')
    expect(table.includes('bg-card rounded-xl overflow-x-auto')).toBe(true)
    expect(/overflow-x-auto">\s*<table/m.test(table)).toBe(true)
  })

  it('wide finance/search tables keep their overflow-x wrappers', () => {
    expect(src('src/components/FinanzasDashboard.tsx')).toContain('overflow-x-auto')
    expect(src('src/components/ComprasDashboard.tsx')).toContain('overflow-x-auto')
  })
})
