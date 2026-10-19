# Development Log

Technical changelog of notable fixes. Useful for onboarding, review, and
retrospectives. Ordered newest first.

## 2026-10-19 — Finanzas search dead on fresh clones; demo-vault seeded

**Impact:** on a fresh clone the whole Finanzas search (and summary,
insights, compare, food-sora) degraded forever: `loadCompras()` and
`loadFoodSora()` called `readdirSync()` on vault paths that only exist
in a mature vault, `initDb()` threw ENOENT, the `dbInitFailed` latch
set, and every query returned empty. The log spammed
`Finanzas DB init error: ENOENT .../Compras` on boot.

**Fix (TDD — 3 new tests in `server/__tests__/finanzas-db.test.js`):**

- `server/lib/finanzas-db.mjs`: `loadCompras()` and `loadFoodSora()`
  now exit gracefully when their vault source dirs don't exist, matching
  the `loadAssets()`/`loadWallet()` guards — the DB initializes clean on
  an empty vault instead of latching the failure.
- `demo-vault/`: seeded `02 - AREAS/008 - Trazabilidad Compras/` with
  Compras (2 tickets, 7 items in inline-fields format), Presupuesto
  (`_budget.md`) and Patrimonio samples, plus
  `08 - SYSTEM/state/exception-log.json` (previously ENOENT noise from
  the todos use-case on every boot).
- `vite.config.js`: dev server port and API proxy target now honor
  `VITE_UI_PORT` / `VITE_API_PORT` so test instances can run beside a
  live dev session.

**Verification:** 78/78 Vitest (incl. finanzas-db resilience tests),
contract/fases suites green. Live UI smoke (puppeteer on a 5175+3003
test pair): Compras search input typed "aceite" → result row renders
with purchase history; store filter populated with seeded comercios;
zero page errors.

**Known follow-up:** the TopBar global search (`Buscar... Ctrl+K`)
writes to `useAppStore.search` which no component consumes — it is
decorative; per-dashboard searches are the real feature.


## 2026-10-19 — Estudio section: restored dropped active-recall + study/history contracts (TDD)

**Impact:** clicking the Estudio section (and every Active Recall panel)
hit endpoints the ADR-025 DI refactor had dropped, and the Mapa sub-tab
crashed the entire React tree (`items is not iterable`). Combined with
the missing process-level safety net, user-facing clicks took the page
or the server down.

**Root causes:**

1. `src/api/active-recall.ts` consumes a 7-endpoint REST surface
   (`GET /all`, `GET /due`, `GET /question/:id`, `POST /submit`,
   `/ingest`, `/inject`, `/seed`); the refactored router only kept
   `POST /review`, `POST /due` and `GET /stats` — everything else 404'd.
2. `GET /api/study/history` returned the bare array from
   `getStudyHistory()` instead of the `StudyHistoryResponse` envelope
   (`{ history, items, stats }`); `setItems(r.items)` set `undefined`
   and `StudyHashmap` crashed iterating it.

**Fix (strict TDD — RED then GREEN):**

- New test files: `server/__tests__/active-recall-routes.test.js`
  (12 tests) and `server/__tests__/study-history-routes.test.js`
  (2 tests), written against the frontend contract and confirmed
  failing (404 / missing envelope) before implementation.
- `server/application/use-cases/active-recall.js`: added `getAll`,
  `getDueWithStats`, `getQuestionById`, `submit`, `ingest`, `seed`,
  `inject` delegating to the legacy store port.
- `server/di-container.js`: store port extended with `getAllQuestions`,
  `getQuestion`, `ingestFromActiveRecall`, `seedQuestions` plus
  `defaultIngestDir` (`ACTIVE_RECALL_DIR` from the vault adapter).
- `server/routes/active-recall.mjs`: mounted the seven missing routes.
- `server/application/use-cases/study-data.js`: `getHistory` now adapts
  the array into the full envelope (grouping by fecha + derived stats:
  total/correct/partial/incorrect/streak/today).
- Updated the interim bare-array expectation in
  `server/__tests__/api.test.js` to the envelope contract.

**Verification:** full suite green — 75/75 Vitest (incl. the 14 new
RED→GREEN tests), 21 contract, 33 fase5, 26 fase6, 14 active-recall
store, acceptance, observabilidad. Live click-drive with puppeteer
covered every Estudio sub-tab (Notas, Cognitivo ×4, Mapa, Anki,
Pomodoro) and every main tab: server alive after each click, zero
React errors, Mapa renders.


## 2026-10-19 — Process-level safety net for CDP-attached integrations

**Impact:** on a machine with a real Brave browser exposing the CDP port
(9222), clicking the Navegador/Conversaciones tabs could kill the whole
Node process — puppeteer attaches to the real browser, and detach/target
events fire rejections outside any request scope. With no
`uncaughtException` / `unhandledRejection` handlers, one event took the
API down on a single UI click.

**Fix:**

- `server/index.js`: global `process.on('unhandledRejection')` and
  `process.on('uncaughtException')` handlers — log loudly, keep serving.
  External-service failures already surfaced as 5xx via route handlers;
  this catches the async strays that routes cannot see.
- `server/infrastructure/brave-cdp-adapter.js`: on successful
  `puppeteer.connect()`, register `browser.on('disconnected')` to null out
  the cached handle so the next call reconnects instead of using a dead
  handle.

**Verification:** full suite green (61/61 Vitest, 21 contract, 33 fase5,
26 fase6, 14 active-recall, acceptance, observabilidad).


## 2026-10-19 — Restore study data endpoints (orphaned by the DI refactor)

**Impact:** the Study dashboard's Notas/Conceptos/Preguntas/Dudas tabs called
`GET /api/study/data` and friends, which answered 404 — the read/write
service (`server/lib/study-service.mjs`) existed but no route mounted it
since the mastery/study DI refactor.

**Fix:**

- New thin use-case `server/application/use-cases/study-data.js` (pure
  factory, functions injected; the DI container wires it from
  `lib/study-service.mjs`).
- `server/routes/study.mjs` mounts `GET /study/data`, `GET /study/history`
  and the three `POST /study/{answer,self-score,feedback-request}` save
  endpoints, delegating to `req.useCases.studyData` — no `lib/` imports in
  the router (boundary §2.1).
- Vitest route tests added (`server/__tests__/api.test.js`): data shape,
  history array, 400 validation.

**Verification:** 61/61 Vitest unit green; live smoke against the bundled
demo vault returned 2 parsed notes, 3 concepts, 4 questions, 2 doubts
(the demo study notes carry `entity_type::` so `detectNoteFormat`
classifies them as inline-fields).

## 2026-10-19 — Demo mode: configurable vault root + first-boot seeds + bundled demo vault

**Impact:** a fresh clone now renders populated dashboards with zero
configuration (`npm install` → `npm run dev`), instead of empty vault panels
and empty stores. The Obsidian vault integration stopped depending on a
hardcoded folder layout.

**Design:**

- **`KBL_VAULT_ROOT` env override** (`server/infrastructure/vault-fs-adapter.mjs`):
  when set, vault-dependent dashboards read a real Obsidian vault; when unset,
  they read the bundled `demo-vault/` inside the repo. Previously the root was
  resolved by walking fixed levels up into a Johnny-Decimal layout that no
  longer matched, so every scan warned `ENOENT`.
- **First-boot store seeds** (`server/seed/mastery-seed.json`,
  `server/seed/active-recall-seed.json`): `ensureStore()` on both JSON stores
  loads the bundled seed when the store file does not exist, then the store
  is normal user-owned data (`server/data/` stays gitignored). Seed keys use
  the same hash functions as `hashConcept` / `hashQuestion` so the Skill Tree
  and Active Recall lookups resolve correctly. Synthetic content only — no
  personal learning data ships in the repo.
- **Bundled `demo-vault/`**: minimal Obsidian-like tree (inbox, projects, areas,
  study notes, journal, queue, system state) with content in the exact formats
  each use-case parses (`_PENDING.md` sections with `**Estado:** / **Prioridad:**`,
  `_PENDIENTES.md`, `_ROADMAP.md` with `## Current` + checkboxes,
  `07 - SCRIPTS/ENTITY_CATALOG.json`, `08 - SYSTEM/state/session-log.json`,
  study notes with `conceptos::` / `definicion::` / `pregunta::` / `duda::`
  inline fields, two of them with the em-dash `Concepto — analogía` syntax the
  concept parser expects).

**Config surface** (documented in `.env.example`): `KBL_VAULT_ROOT`,
`KBL_DATA_DIR`, `MASTERY_STORE_PATH`, `ACTIVE_RECALL_STORE_PATH`,
`MASTERY_SEED_PATH`, `ACTIVE_RECALL_SEED_PATH`.

**Verification:**

- Full suite green after the change (58/58 Vitest unit, 21 contract, 26 fase6,
  14 active-recall, acceptance, observabilidad).
- Local smoke: `/api/overview` (10 demo notes, health info), `/api/projects`
  (2 demo projects), `/api/todos` (3 demo tasks with states), `/api/context`
  (2 pendientes + roadmap current/pending/completed).
- Fresh-clone smoke (`git clone` into `/tmp`, `npm install`, boot): stores boot
  from seeds, demo vault feeds the scanner.

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
