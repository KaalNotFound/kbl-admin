// Design token contract — every custom utility class referenced in src must
// be defined in tailwind.config.js or src/index.css (issue #1, slice 1).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function readAllTsx(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? readAllTsx(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
  )
}

const config = readFileSync('tailwind.config.js', 'utf8')
const css = readFileSync('src/index.css', 'utf8')
const used = readAllTsx(join(process.cwd(), 'src')).map((p) => readFileSync(p, 'utf8')).join('\n')
const kblNames = [...new Set([...used.matchAll(/[a-z-]*kbl-([a-z0-9-]+)/g)].map((m) => m[1]))]
const gradientNames = [...new Set([...used.matchAll(/text-gradient-([a-z-]+)/g)].map((m) => m[1]))]
const TW_DEFAULTS = /^(pulse|spin|ping|bounce)$/

describe('design tokens contract', () => {
  it('defines every kbl-<color> used in src under colors.kbl, backed by real CSS vars', () => {
    const colors = [...config.matchAll(/'(kbl-[a-z-]+)':\s*'rgb\(var\(--([a-z-]+)\)/g)]
    for (const name of kblNames) {
      if (name === 'theme' || name.startsWith('reporte')) continue // non-class identifiers (csv filename, theme attr)
      const def = colors.find((c) => c[1] === `kbl-${name}`)
      expect(def, `tailwind.config.js missing colors.kbl-${name} mapping`).toBeDefined()
      expect(css.includes(`--${def[2]}:`), `index.css missing --${def[2]}`).toBe(true)
    }
  })

  it('defines every custom animate-* used in src', () => {
    const animations = [...used.matchAll(/animate-([a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !/__/.test(n))
    for (const name of new Set(animations)) {
      if (TW_DEFAULTS.test(name)) continue
      expect(config.match(new RegExp(`'${name}':`)), `tailwind.config.js missing animation '${name}'`).toBeDefined()
    }
  })

  it('defines every text-gradient-* used in src in index.css', () => {
    for (const name of gradientNames) {
      expect(css.match(new RegExp(`\\.text-gradient-${name} \\{`)), `index.css missing .text-gradient-${name}`).toBeDefined()
    }
  })

  it('extends invalid-default utilities used in src (scale-130, duration-600)', () => {
    expect(config.match(/130:/)).toBeDefined()
    expect(config.match(/600ms/)).toBeDefined()
  })
})
