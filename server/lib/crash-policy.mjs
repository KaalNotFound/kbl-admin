/**
 * Crash policy — process-lifetime decision for uncaught exceptions.
 *
 * Uncaught exceptions leave process state unknowable, so supervised / CI runs
 * MUST crash loudly and let the supervisor restart with clean state.
 * The interactive local dashboard prefers continuity: a benign bug (usually a
 * dropped CDP or watcher event) should not take the whole wheel down.
 *
 * Env contract: KBL_EXIT_ON_UNCAUGHT=1 → exit(1); anything else → keep serving.
 *
 * @param {object} env - Environment (defaults to process.env)
 * @returns {boolean} true when the process should exit on uncaughtException
 */
export function shouldExitOnUncaught(env = process.env) {
  return env.KBL_EXIT_ON_UNCAUGHT === '1';
}
