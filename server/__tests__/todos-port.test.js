/**
 * vault-todos write-back through the vault port — B8 (DIP), TDD RED → GREEN.
 *
 * The use-case's own header stated "no fs" while toggleTodo() still wrote
 * with raw fs.writeFileSync/renameSync/rmSync, bypassing the injected vault
 * port. The port now exposes writeFileAtomic (same crash-safe semantics:
 * temp file + rename + best-effort cleanup, owned by the adapter where the
 * fs lives). This test pins the contract: toggleTodo() must delegate the
 * write to the port and succeed with a fake port that provides ONLY port
 * methods.
 */

import { describe, it, expect, vi } from 'vitest'
import { createTodosUseCases } from '../application/use-cases/vault-todos.js'

// Path never exists — pre-fix the use-case would fs.writeFileSync into it
// and blow up with ENOENT instead of consulting the port.
const FAULTY_ROOT = '/kbl-b8-port-test/nonexistent-root'

const SEED = [
  '## Demo task (2026-11-09)',
  '',
  '**Estado:** in-progress',
  '',
  'Prose line that must survive byte-identical.',
].join('\n')

function buildVaultPort() {
  return {
    VAULT_ROOT: FAULTY_ROOT,
    readFile: vi.fn(() => SEED),
    scanAreaRecursive: vi.fn(() => []),
    writeFileAtomic: vi.fn(() => true),
  }
}

describe('vault-todos.js — writes through the vault port (B8)', () => {
  it('toggleTodo delegates the atomic write to the vault port', async () => {
    const vault = buildVaultPort()
    const uc = createTodosUseCases({ vault })

    const res = await uc.toggleTodo({ line: 0 })

    expect(res.status).toBeUndefined() // success shape {item, sources, toggled}
    expect(res.toggled.mode).toBe('estado')
    expect(res.toggled.from).toBe('in-progress')
    expect(res.toggled.to).toBe('done')
    expect(vault.writeFileAtomic).toHaveBeenCalledTimes(1)
    const [writtenPath, writtenContent] = vault.writeFileAtomic.mock.calls[0]
    expect(writtenPath).toContain('_PENDING.md')
    expect(writtenContent).toContain('**Estado:** done')
    expect(writtenContent).toContain('Prose line that must survive byte-identical.')
  })

  it('surface port write failure as a clean {status, error}', async () => {
    const vault = buildVaultPort()
    vault.writeFileAtomic = vi.fn(() => false)
    const uc = createTodosUseCases({ vault })

    const res = await uc.toggleTodo({ line: 0 })

    // 2 attempts (one flip + one documented retry), each write fails → 500
    expect(res.status).toBe(500)
    expect(typeof res.error).toBe('string')
  })
})
