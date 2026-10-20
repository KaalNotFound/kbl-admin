# Development Log

Technical changelog of notable fixes. Useful for onboarding, review, and
retrospectives. Ordered newest first.

## 2026-10-20 — Phase 2: finanzas live sync — chokidar watches the vault, no restarts

The SQL.js finanzas DB was a STARTUP SNAPSHOT: `finanzas-db.mjs` scanned
the whole vault once at boot, so a ticket edited in Obsidian stayed stale
until the server was restarted. Phase 2 wires a chokidar file watcher
that incrementally re-indexes changed files into the RUNNING database
(TDD strict: 7 RED tests before any implementation, suite 108 → 115/115,
vite build OK).

**`server/lib/finanzas-watcher.mjs` (new):**

- Watches DIRECTORIES (never individual files — the validated pattern
  from obsidian-brain/Cairn/vault indexers): Compras, Patrimonio, Daily
  (<VAULT_ROOT>/05 - JOURNAL) and the `pau-agent` dir holding
  `_wallet.json`. Never touches ports; `KBL_WATCH=0` disables it (CI).
- `ignoreInitial: true`, `awaitWriteFinish: {stabilityThreshold: 250,
  pollInterval: 100}` (Obsidian autosaves in chunks), dotfiles ignored
  (`.obsidian/`, hidden), and a per-path 1200ms LAST-EVENT-WINS debounce:
  a burst of autosave changes on one file coalesces into ONE re-index.
- Incremental upsert per fs event: re-parse THAT file only → `DELETE`
  rows for its `archivo` provenance path → insert fresh rows. No full
  rescan ever. Deletion of a file removes its rows (exact relative path
  + `*/<basename>` + bare-basename heuristics). `_wallet.json` change →
  wipes `wallet:%` income rows and re-runs the hardened loader; rename =
  unlink + add events → converged by the pair.
- Every apply is guarded: one bad file degrades only itself — recorded
  as `<source>:<basename>` in `getInitDiagnostics().sources` — and never
  crashes the process nor latches `dbInitFailed`.
- `startFinanzasWatcher()` awaits `ensureDb()` (declines with
  `db-init-failed` if false), is double-start guarded at module level
  (`already-started`), and awaits the chokidar initial scan so callers
  editing right after the promise resolves never lose events.
  `stopFinanzasWatcher()` + `_resetWatcherForTest()` close timers
  deterministically.

**`server/lib/finanzas-db.mjs` (refactor, behavior-preserving):**

- Three per-file parsers extracted as the single source of truth for
  BOTH the full loaders and live sync — they can't diverge:
  `parseComprasFile(content, relArchivo)`, `parseFoodSoraFile(...)`,
  `parseAssetsFile(...)`; `loadCompras/loadFoodSora/loadAssets` now
  collect their rows through them (zero behavior change, pinned by the
  untouched existing suite).
- New incremental helpers consumed by the watcher: `upsert*/remove*`
  per source plus `clearWalletRows()/refreshWallet()`.

**Boot wiring (`server/index.js`):** `startFinanzasWatcher()` fires
and-forget inside the `isMain` block (dynamic import so test-time
imports of the app stay side-effect free), `.catch` logs — a watcher
failure can never prevent boot or block `listen`.

**Tests (`server/__tests__/finanzas-watcher.test.js`):** temp-vault
harness (same mechanics as `finanzas-resilience.test.js`), REAL timers
only — bounded retry waits poll every 200ms for up to ~6s (20s test
timeout) so OS event → awaitWriteFinish → debounce is deterministic on
CI without fake time. Covers: modified `precio_total` (incl. comma
decimals `42,75` → 43) visible without restart, new file indexed,
deleted file's rows removed, food_sora slot edited in a Daily note,
unreadable file (rows intact + `error` recorded + repair restores),
double-start guard, and `KBL_WATCH=0`.

**Verification:** full suite 115/115, `vite build` OK, live boot check
(API on port, watcher reports watching the real vault dirs alongside
the Phase-1 full load).

## 2026-10-20 — Phase 1: data provenance + `obsidian://` deep links

Every vault-sourced row now exposes where it came from, one click away
from the raw note (TDD strict: 9 RED tests before any implementation,
suite 99 → 108/108, vite build OK).

**Backend:**

- New `server/lib/obsidian-url.mjs`: single helper building
  `obsidian://open?path=<encoded absolute path>` (per the official
  Obsidian URI — the `path` param makes Obsidian itself resolve which
  vault contains the file, no vault-name config needed).
- `finanzas-db.mjs`: `assets` and `food_sora` schemas gained an
  `archivo` column; all three loaders (compras/assets/food_sora) now
  store vault-relative, `/`-normalized paths instead of bare filenames
  (items already did, but relative-only).
- Provenance added on the wire without breaking shapes: `/api/search`
  and `/api/compare` rows carry `archivo` + `obsidian_url`;
  `/api/patrimonio` rows too; `/api/food-sora` data rows point at the
  Daily note (stats aggregate stays clean); `/api/todos` and
  `/api/context` responses carry `sources: [{file, obsidian_url}]` for
  `_PENDING.md` / `_PENDIENTES.md` / `_ROADMAP.md`.
- `obsidianUrl` is injected through the DI container/vaultFsApi — the
  use-cases layer stays free of lib imports (ADR boundary preserved).

**Frontend:**

- `src/lib/obsidian.ts`: `openObsidian()` + anchor-attrs helper
  (`target="_blank" rel="noopener noreferrer"`).
- Provenance chips, wired to existing UI style language: ↗ next to
  Compras product rows, ↗ next to Patrimonio asset rows (the rows live
  in `PatrimonioDashboard.tsx`, not `FinanzasDashboard.tsx` — deviation
  verified against the actual render tree), "Open _PENDING.md ↗" in the
  TODO header, "Edit in Obsidian ↗" chips for `_PENDIENTES.md` /
  `_ROADMAP.md` in Session Context.

**Verification:** temp-vault HTTP contract tests (search/compare/
patrimonio/food-sora/todos/context), URL-shape unit tests, full suite
108/108, live curl checks (URL percent-encoding confirmed faithful, e.g.
`obsidian://open?path=%2Fhome%2F...%2FCompras%2F2026-10-16_carrefour.md`).

## 2026-10-20 — Phase 0: finanzas survives malformed vault data (per-source isolation)

**Context:** the data-provenance audit verdict was "robust against
absence, fragile against garbage". A single hand-broken file killed the
entire finanzas domain. This phase hardens the parse layer so every
vault data source degrades ONLY itself (TDD: 11 new tests RED → GREEN,
suite 99/99).

**Per-source isolation (`server/lib/finanzas-db.mjs`):**

- `initDb()` no longer wraps all four loaders in one try/catch. Each
  source (compras, food_sora, assets, wallet) runs through
  `loadSource()` — a corrupt `_wallet.json` previously latched
  `dbInitFailed=true` forever and killed summary + compras + food-sora +
  patrimonio together.
- New `getInitDiagnostics()` exposes `{initialized, initFailed,
  sources: {compras: 'ok:1', wallet: 'error:...'}}` — the seed for a
  future Vault Doctor page.
- `loadWallet()` guards: not-valid-JSON and non-array `entries` throw a
  descriptive error (caught isolately); individual malformed entries are
  skipped instead of crashing the insert loop; amounts validated as
  finite numbers.

**Number parsing tolerates both conventions:**

- `normalizeNumber()`: last dot-or-comma block is the decimal one. Now
  `19,99` → 20 (was silently truncated to 19), `1.234,56` and
  `1,234.56` → 1235, `€3,40` → 3. New test file documents the known
  ambiguity: bare `1.234` reads as a decimal (heuristic documented in
  code comment).

**Runway survives corrupt `presupuesto-state.json`**

- (`finanzas-core.mjs`): single guarded `readPresupuestoState()` —
  corrupt JSON, non-object or non-finite `saldo` returns `null` and
  logs a warning instead of cascading NaN.
- (`finanzas-runway.mjs`): uses the reader once, validates
  `saldo_anterior`/`fecha_saldo` individually, skips reconciliation on
  missing state — saldo falls back to perfil defaults.

**Live verification:** temp vault with corrupt wallet + corrupt
presupuesto-state + one valid `precio_total:: 12,50` ticket —
`/api/summary` (total: 13), `/api/search` (item found with archivo) and
`/api/finanzas` (finite runway, reconciliacion null) all stay UP.

## 2026-10-19 — Food Sora dashboard survived an empty vault (Finanzas demo complete)

**Symptom:** entering Finanzas → Food Sora killed the entire page with
`Reduce of empty array with no initial value`. A fresh clone had no Daily
notes with `*_food_sora::` fields, so `stats.by_slot` arrived empty and
`useMemo` ran `stats.by_slot.reduce((a, b) => ...)` with no initial
value — an uncaught render crash that unmounted the whole React tree.

**Frontend fix (`src/components/FoodSoraDashboard.tsx`):**

- `bestSlot` guards `stats?.by_slot?.length` (reduce needs an initial
  value or a non-empty array).
- `by_slot?.map`, `by_slot?.filter` and `calendar?.slice` hardened
  against partial/degraded envelopes.

**Demo seeds (`demo-vault/05 - JOURNAL/Daily/`):** the section represents
the feeding log of a cat, so an empty calendar made the demo feel broken.
Added 11 daily notes (2026-10-08 → 2026-10-18) with realistic slot
records (`manana_food_sora:: 08:15`, etc.). The dashboard now shows
11 days, streak 11, 38/55 meals, 69% rate and per-slot averages.

**Contract tests (`server/__tests__/food-sora-routes.test.js`):** pin
`/api/food-sora` + `/api/food-sora/stats` envelopes (every documented
key present) and assert the bundled demo-vault yields populated stats.
Suite: 88/88.

**Verification:** live click-drive in two modes — seeded vault (hero +
calendar + per-slot + detail all render, zero page errors) and an empty
vault (`0 días registrados` honest state, zero page errors).

## 2026-10-19 — Global search palette wired (Buscar... Ctrl+K is now real)

**Impact:** the TopBar global search wrote to `useAppStore.search`, which
no component consumed — typing in "Buscar... Ctrl+K" did nothing, exactly
what a demo reviewer would call out. Both halves now exist:

**Backend (TDD — 7 tests in `server/__tests__/global-search.test.js`):**

- New `GET /api/global-search?q=<term>` route (`server/routes/global-search.mjs`,
  thin, DI-only) powered by a new `global-search` use-case
  (`server/application/use-cases/global-search.js`).
- Searches five domains, every result carries a `tab` field for frontend
  navigation: vault markdown notes (title match + bounded content scan with
  snippet extraction, depth ≤ 4, capped at 6 per group), projects,
  study concepts (mastery store), todos and the entity catalog.
- Wired post-assignment in the DI container (reuses already-built
  `projects`, `todos`, `entityTypes` use-cases + the legacy mastery store).
- Guardrails: min query length 2, malformed/unicode terms never crash,
  empty vaults degrade to fewer/empty groups silently.

**Frontend:**

- New `src/api/search.ts` typed client + barrel re-export.
- New `src/components/layout/SearchPalette.tsx`: debounced (250ms) dropdown
  under the TopBar input — grouped results with kind chip, meta/snippet,
  keyboard navigation (↑/↓, Enter navigates and clears, Esc closes),
  outside-click dismiss, Ctrl/Cmd+K global focus shortcut as promised by
  the placeholder. TopBar now renders the palette instead of the dead input.

**Verification:** 85/85 Vitest; Vite build clean; live puppeteer smoke on a
5175+3003 test pair: dropdown renders groups, Enter/arrow navigation lands
on the target dashboard and clears the input, Ctrl+K focuses, Esc closes,
zero page errors. Frontend TS has pre-existing strict-mode errors elsewhere
(23, unchanged); none in the new files.


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
