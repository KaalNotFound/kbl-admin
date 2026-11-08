import fs from 'node:fs'
import path from 'node:path'

/**
 * Resolve a path to its real location, walking up to the nearest existing
 * ancestor when the target itself does not exist yet. This keeps the check
 * meaningful for directories that will be created later.
 */
function realpathWithFallback(target) {
  try {
    return fs.realpathSync.native(target)
  } catch {
    const parent = path.dirname(target)
    if (parent === target) return target
    return path.join(realpathWithFallback(parent), path.basename(target))
  }
}

/**
 * Check that `candidate` resolves inside `root` after symlinks are followed.
 *
 * @param {string} root Allowed root directory.
 * @param {string} candidate Absolute or relative path to validate.
 * @returns {{ ok: true, path: string } | { ok: false, reason: string }}
 */
export function resolveWithinRoot(root, candidate) {
  try {
    if (typeof root !== 'string' || !root) {
      return { ok: false, reason: 'root is required' }
    }
    if (typeof candidate !== 'string' || !candidate) {
      return { ok: false, reason: 'candidate is required' }
    }

    const realRoot = realpathWithFallback(path.resolve(root))
    const realTarget = realpathWithFallback(path.resolve(realRoot, candidate))

    if (realTarget === realRoot || realTarget.startsWith(realRoot + path.sep)) {
      return { ok: true, path: realTarget }
    }
    return { ok: false, reason: 'path escapes allowed root' }
  } catch (err) {
    return { ok: false, reason: err?.message || 'invalid path' }
  }
}
