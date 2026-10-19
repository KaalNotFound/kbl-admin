# Development Log

Technical changelog of notable fixes. Useful for onboarding, review, and
retrospectives. Ordered newest first.

## 2026-10-19 — Fixed boot crash: JSON stores wrote to a non-existent vault directory

**Impact:** the backend failed to start on any machine whose surrounding
folder layout did not match the original hardcoded paths (`node server/index.js`
crashed with `ENOENT` at import time). Two contract test suites
(`test-fase6.mjs`, `test-observabilidad.mjs`) and one Vitest file
(`mastery.test.js`) failed for the same root cause.

**Root cause (two stacked problems):**

1. `server/lib/mastery-store.js` and
   `server/infrastructure/active-recall-store.js` wrote their JSON stores to
   `<vault>/08 - SYSTEM/_system/` at module load time (`ensureStore()` ran on
   import through the DI container). When the vault layout was restructured
   (2026-08-18), the `08 - SYSTEM` folder ceased to exist.
2. The path resolution itself was a level short: `path.resolve(__dirname, '..',
   '..', '..')` from `server/lib/` landed on `vault/projects`, not on the
   intended root, silently pointing writes at a deeper wrong location.
3. *(test-only, secondary)* The `fs` mock in `server/__tests__/mastery.test.js`
   did not implement `mkdirSync`, which the new atomic-write helper calls.

**Fix:**

- Both stores now persist to a project-local directory: `KBL_DATA_DIR`
  (default `server/data/`), overridable per-file via `MASTERY_STORE_PATH` /
  `ACTIVE_RECALL_STORE_PATH`. This removes the vault coupling from persistence
  and makes a fresh clone boot standalone (deepened in 2026-10-19: the
  appropriate design choice for a repo that graders clone and run).
- `writeStore()` on both stores creates the parent directory with
  `fs.mkdirSync(dir, { recursive: true })` before the atomic tmp+rename write.
- Existing user data was migrated from the vault's legacy backups:
  `vault/legacy/08-SYSTEM-governance-legacy-20260818/` → `server/data/`.
  Of the four legacy copies, the newest ones (5 mastery concepts, lastUpdated
  2026-08-12; 139 active-recall questions) were used as the source of truth.
- Added `mkdirSync` to the `fs` test mock.

**Behavior preserved where it matters:**

- Vault-dependent dashboards (`/api/overview`, todos, projects, context, …)
  already degrade gracefully (HTTP 200 + `health: "warn"` + empty sections)
  when the vault folders are absent — verified by smoke test after the fix.

**Verification:**

- `node server/index.js` boots: `KBL Admin API running on http://127.0.0.1:3002`
- Full suite green: 58/58 Vitest unit, 33/33 fase5, 26/26 fase6, 21/21
  contract, acceptance, active-recall 14/14, observabilidad.
- `npm run build` compiles.

**Env surface added** (documented in `.env.example`): `KBL_DATA_DIR`,
`MASTERY_STORE_PATH`, `ACTIVE_RECALL_STORE_PATH`.
