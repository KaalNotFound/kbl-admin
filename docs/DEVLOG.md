# Development Log

Technical changelog of notable fixes. Useful for onboarding, review, and
retrospectives. Ordered newest first.

## 2026-11-09 — Security perimeter slice 8: Vite 8 + Vitest 5 upgrade clears the last dev advisories (issue #3)

Final slice of the dependency modernization: `npm audit` had two dev-chain
advisories with no non-breaking fix — tinypool ≤2.1.1 (critical, RCE-capable
prototype-pollution gadgets, via vitest) and esbuild ≤0.24.2 (moderate,
dev-server request forgery GHSA-67mh-4wv8-2f99, via vite).

- Upgraded the toolchain majors: `vite ^5.4.2 → ^8.3.7`,
  `vitest ^2.1.9 → ^5.1.0`, and `@vitejs/plugin-react ^4.3.1 → ^6.0.0`
  (required adapter: plugin-react 6 is the first line declaring the
  `vite ^8.0.0` peer; 4.x/5.x cap at vite 7).
- Both advisory targets left the tree entirely: vitest 5 no longer uses
  tinypool and vite 8 builds on rolldown/oxc instead of esbuild
  (`npm ls tinypool esbuild` → empty). No overrides or forced resolutions
  were needed.
- Configs needed zero changes: `vitest.config.js` (defineConfig, node
  environment, globals) and `vite.config.js` (react plugin, port/proxy,
  outDir) use only APIs that survived both majors.
- Vitest 5 tightened `vi.fn()` constructor semantics: a mock invoked with
  `new` must have a `function`/`class` implementation (vitest ≤4 silently
  allowed arrow implementations). The two `vi.mock('../infrastructure/
  brave-cdp-adapter.js')` blocks in `api.test.js` and `mastery-routes.test.js`
  converted their `mockImplementation(() => ({…}))` arrows to named function
  implementations returning the object — mechanical, 2 files.
- Engine floor raised: vitest 5 requires node `^22.12.0 || ^24.0.0 ||
  >=26.0.0` (vite 8 requires `^20.19.0 || >=22.12.0`). `package.json`
  engines `>=18 → >=22.12.0`; CI matrix `[20, 22] → [22, 24]` (node 20
  can no longer run vitest).

**Gates:** suite 306/306 green (29 files), contract/acceptance/fase suites
green, `npx vite build` OK, `npm audit` → `found 0 vulnerabilities` in BOTH
modes (full and `--omit=dev`). Prod-audit CI gate unaffected.

## 2026-11-09 — Security perimeter slice 4: exception handling + outbound bounding (issue #3)

Stop raw `error.message` leaks and bound hanging outbound calls (A09/A10/LLM05).

- Routes stopped returning raw exception messages: mastery (10 catch blocks),
  study (7) and capture now answer with `logAndRespond` — throttled server-side
  logs, generic Spanish body, original HTTP status kept. Capture 4xx keeps the
  curated triage copy (HTTP contract in capture-triage), 5xx bodies are
  sanitized; batch failure items no longer carry the raw message.
- `server/lib/crash-policy.mjs`: uncaughtException policy —
  `KBL_EXIT_ON_UNCAUGHT=1` exits 1 (supervised/CI); default keeps serving.
- requestLogger now mounts BEFORE the API routers (matched routes log
  request.start/end; previously the timing middleware was unreachable for
  matched paths).
- Outbound calls bounded: CDP discovery `resolveCdpEndpoint` (5s fetch —
  puppeteer's browserURL path was unbounded), brave use-case CDP HTTP fetches
  (5s), NotebookLM proxy hard 30s AbortSignal (its 60s socket timeout never
  fires on slow-drip responses). anki already had its 5s bound.

**Gates:** suite 272 baseline + new tests
(`server/__tests__/security-exceptions-logging.test.js`) → 286/286 green.
`npx vite build` OK.

## 2026-11-09 — Security perimeter slice 3: data integrity at trust boundaries (issue #3)

Frontmatter injection, LLM output validation and seed/inject mass assignment.

- New `server/lib/frontmatter-guard.mjs`: `sanitizeFrontmatterValue` collapses
  newlines/control chars, neutralizes `::` → `: :`, trims, caps at 500, so a
  client value can never forge a `key::` field; `sanitizeMultilineField`
  preserves newlines but escapes field-looking lines (leading space), cap 4000.
- `capture-note` compra fields (comercio/producto/cantidad/precio_total/
  categoria) and `vault-inventory` category/notes now go through the guard.
  Normal values are byte-identical; the parser format stays intact.
- `mastery.js` exports pure `normalizeEvaluation`: validates the parsed LLM
  verdict at the boundary (score must be a finite number or the caller falls
  back to the basic heuristic; clamped 0..100; feedback ≤2000, strengths/gaps
  ≤10 items × ≤300, challenge ≤500 or null) — prompt is data, not authority
  (LLM01/LLM09). `basicEvaluation` clamps defensively too.
- `active-recall` seed/inject normalize each question to an allowlist
  (question ≤2000 required, answer/module/source/tags bounded); unknown fields
  are dropped, invalid entries → 400 `Formato de pregunta inválido.`
  (API3). Client-sent `type/concept/definition` are no longer persisted.

**Gates:** suite 256 → 273/273 green (17 new tests in
`server/__tests__/security-data-integrity.test.js`). `npx vite build` OK.

## 2026-11-08 — Security perimeter slice 2 (issue #3)

Contained filesystem ingest and capped request payloads.

- New `server/lib/path-guard.mjs` `resolveWithinRoot(root, candidate)`:
  resolves both paths with `realpathSync.native` (walking up to the nearest
  existing ancestor when the target does not exist yet) and only accepts paths
  equal to the root or prefixed by `root + sep`. Rejects `..` escapes,
  absolute paths outside the root and symlinks pointing outside. Never throws.
- `POST /active-recall/ingest` now validates `body.dir` against the injected
  `defaultIngestDir` (`vaultFs.ACTIVE_RECALL_DIR`) before calling the store;
  outside → 400 `Directorio de importación fuera del vault permitido.` The
  route propagates that status.
- `seed`/`inject` cap batches at 500 questions and reject non-object entries.
- `ingestFromActiveRecall` caps recursion at depth 12, 2000 files, 1 MB per
  file and 20 MB total; skips symlinks entirely. The numeric return value is
  preserved (legacy callers) and truncation is reported through the optional
  `onTruncated` out-param; caps are overridable via `{ caps }`.
- `POST /capture/batch` rejects more than 100 captures with a Spanish 400 via
  the exported `assertBatchSize` helper.

**Gates:** suite 241 → 256/256 green (15 new tests in
`server/__tests__/security-fs-containment.test.js`). `npx vite build` OK.

## 2026-11-08 — Security perimeter slice 1 (issue #3)

Fail-closed perimeter, read-only demo mode, constant-time auth, and CSP.

- `server/middleware/security.mjs`: rate limiting now runs BEFORE API-key
  auth, so repeated bad keys return 429 instead of unlimited 401s. Auth reads
  only `x-api-key` (query `api_key` rejected) and compares with
  `crypto.timingSafeEqual` behind a length guard; rejections are logged
  throttled and never include the provided key.
- New `assertSafeBind({ host, apiKey, demoMode })`: throws a Spanish error
  when binding a non-loopback host without `API_KEY` and without demo mode.
  Called in `server/index.js` inside the `isMain` block only.
- New `createDemoModeMiddleware({ demoMode })` + `KBL_DEMO=1`: GET/HEAD/OPTIONS
  pass, mutating methods under `/api` return 403 with
  `Demo pública: modo solo lectura.`. Mounted after JSON parsing.
- CORS defaults to same-origin (no `*`); configured `CORS_ORIGINS` are echoed.
  Helmet CSP is enabled (`default-src 'self'`, `frame-ancestors 'none'`, fonts
  allowed for Google Fonts), overridable via `opts.cspDirectives`.

**Gates:** suite 228 → 241/241 green (13 new tests in
`server/__tests__/security-hardening.test.js`). `npx vite build` OK.

## 2026-11-06 — Algorithms: pseudo-code execution panel on all 8 tabs (issue #2 stretch)

The "Punto de ejecución" pseudo-code trace was Bubble-only; now every
visualizer tab shows it.

- `src/components/algorithms/PseudoCodePanel.tsx` (new): shared panel,
  same visual design as the old Bubble-only CodeTracePanel (bg-card card,
  mono `pre`, padded line numbers, bg-accent-light row highlight).
- All 8 `src/algorithms/*.js` metas gained a `pseudocode` block: python-like
  `lines` faithful to the real loops plus a `mapping` from each `frame.line`
  key to the highlighted row (null for terminal frames). Counting shows the
  count + placement phases; radix shows per-digit bucket passes with stable
  collection. `frameTypes` documents the typedef.
- `SortVisualizer`: when `meta.pseudocode` exists it renders the shared
  panel last in the aside, with `activeIndex = mapping[frame.line] ?? null`.
  Per-algorithm `renderAside` panels still compose before it.
- `BubbleSortVisualizer`: local CodeTracePanel/CODE_LINES/LINE_TO_CODE
  removed (redundant); only the Bubble ExecutionStatePanel remains in
  `renderAside`.

**Gates:** suite 225 → 228/228 green (3 new tests in
`server/__tests__/pseudocode.test.js`: non-empty lines for all 8 metas,
mapping coverage of every `frame.line` emitted by each generator on a sample
array, mapping values in row range or null). `npx vite build` OK.

**Runtime proof** (PORT=3007 + vite 5177, killed afterwards): on Bubble,
two "Siguiente paso" clicks move the highlight row 1 → 5 while stepping;
on every other tab the "Punto de ejecución" panel renders with non-empty
code. Screenshots: `/tmp/opencode/ps-{bubble,selection,insertion,heap,merge,
shell,counting,radix}.png`.

## 2026-11-05 — Algorithms slice 2: Merge Sort + Shell Sort visualizers (issue #2)

Slice 2 of 3 of the sort-algorithms module: two more frame engines behind the
shared `SortVisualizer`, zero changes to the visualizer itself.

**What was added:**

- `src/algorithms/merge.js` — Merge Sort as an **iterative bottom-up** merge
  (width 1 → 2 → 4…). Per the slice-1 constraint (no tree view), merge levels
  are represented with grouped highlights: each `merge` frame highlights both
  ranges being fused (`highlight = [lo..mid) + [mid..hi)`), announces the
  width in a `split` frame, and confirms each fused run in a `merged` frame.
  Counter semantics: `comparisons` per element comparison, `swaps` per write
  to the aux output (monotonic, matching counters elsewhere). Meta:
  O(n log n) all cases, O(n) space, **stable**.
- `src/algorithms/shell.js` — Shell Sort using the **Ciura gap sequence**
  (`[1750, 701, 301, 132, 57, 23, 10, 4, 1]`, filtered `g < n`; the app caps
  input at 24 items so no extension-by-series is needed). Each pass announces
  its stride in a `gap` frame, then plays a gapped insertion sort whose
  `compare`/`shift` frames reuse the insertion-style fields; shifts count as
  swaps. Meta: best O(n log n), avg marked "depends on the gap sequence", worst
  O(n²), O(1) space, **unstable** (honest: Ciura's average bound is not proven).
- `AlgorithmsDashboard.tsx`: two new pills — 🔀 Merge Sort, 🐚 Shell Sort —
  now six tabs, still one shared mount of SortVisualizer.

**Notably NOT changed:**

- `SortVisualizer.tsx` untouched: the existing frame vocabulary from
  `frameTypes.js` (compare/swap/highlight/line/comparisonText) carries all
  the new information, so the build stayed a pure engine addition.

**Verification:**

- `server/__tests__/algorithm-generators.test.js` extended (TDD: RED first —
  suite failed on the missing module import). Merge + shell join the shared
  property tests (sorted output for 5 known cases, vocabulary, counters),
  size 1/8/20 cases with duplicates, a purity check (same seed → identical
  frames), a merge-range highlight test, and a Ciura gap-sequence test.
- Full suite: **208/208** (200 baseline + 8 new). `vite build` OK.
- Puppeteer runtime proof (ports 3007/5177): six pills clicked, each active
  pill computed `bg-accent`; Merge play advanced the comparisons counter;
  screenshots at `/tmp/opencode/algo2-{merge,shell}.png`.

## 2026-11-05 — Algorithms slice 1: shared frame engine + algorithm switcher (issue #2)

BubbleSortVisualizer was a 560-line monolith (HEAD tally): the frame generator,
the playback loop, bars, counters, big-O table, movement matrix and the
pseudo-code panel lived in one component. Adding a second algorithm meant
copying ~450 of those lines and changing the loop — the dashboard switcher was
blocked on that copy-paste wall.

Slice 1 removes the wall instead of multiplying it:

- **`src/algorithms/frameTypes.js`** — one frame vocabulary every generator
  emits (`arr`, `i/j`, `compare`, `swap`, `highlight`, `sortedFrom`, `line`,
  `comparisonText`, running counters, `done`, Spanish `description`) plus the
  `snap`/`finish` helpers the engines assemble frames with.
- **`src/algorithms/{bubble,selection,insertion,heap}.js`** — one pure,
  deterministic generator per file (no `Math.random` in the engine), each
  exporting its own big-O/stability `*_META` (label, O-table, stability).
  `src/algorithms/input.ts` keeps `parseArray` (bracket-optional comma/space
  list, 1..24 integers, Spanish errors).
- **`src/components/algorithms/SortVisualizer.tsx`** — one shared frame
  player: seed input card, playback (step / play / pause / reset + three
  speeds), diff-colored bars, live counters, big-O table and movement matrix.
  `renderAside(frame)` is the extension seam — per-algorithm panels plug in
  fed with the current frame without touching the player.
- **`src/components/BubbleSortVisualizer.tsx`** — 560 → ~100 lines: only the
  Bubble pseudo-code trace + execution-state aside remain, around the shared
  player via `ALGORITHM_META.bubble`.
- **`src/components/AlgorithmsDashboard.tsx`** — switcher with four pill tabs
  (Bubble | Selection | Insertion | Heap); switching remounts the player so
  playback state restarts.
- **`server/__tests__/algorithm-generators.test.js` + `algorithm-bubble.test.js`**
  — 19 engine tests, plus 3 `parseArray` tests: sorted-output property (known,
  empty, single, duplicates), heap over trees of 1/8/20 with duplicates,
  Selection exact swap contract (`[4,1,3,2]` → exactly 2 swaps; sorted input →
  0), Bubble early exit, per-algorithm meta completeness and input parsing.

Gates: suite 181 → 188 after commit A (engine extraction), → 200/200 after
commit B (switcher + 3 more generators); `vite build` OK after each commit;
puppeteer runtime proof: the four tabs switch (`bg-accent` on the active pill,
asserted via computed styles) and Heap playing increases the comparisons
counter above zero. One file per algorithm, never a second monolith.

## 2026-11-05 — Design tokens slice 1: kbl-* classes rendered correctly (issue #1)

Dashboards were shipping class names Tailwind had never been taught: ~86
`text-/bg-/border-/from-/to-kbl-*` references, `text-gradient-green/blue`,
`animate-card-enter`, `animate-glow-pulse`, `animate-hero-shimmer` plus
invalid-default `scale-130` and `duration-600`. Undefined utilities don't error
— they silently no-op, so severity dots rendered transparent and error text
fell back to whatever color the parent happened to have (measured inherit:
`rgb(224,160,160)` instead of the danger token).

Slice 1 (made existing classes render, no hex migration yet):

- **`tailwind.config.js`** — `colors.kbl.*` maps every used legacy name onto
  existing semantic CSS vars (`kbl-red→--danger`, `kbl-amber→--warning`,
  `kbl-green→--positive`, `kbl-blue→--accent`, `kbl-blue-dark→--accent-alt`;
  semantics verified against the Vault Doctor severity map: red=error,
  amber=warn, green=ok). Added `cardEnter`, `glowPulse` (2.4s subtle opacity
  pulse), `heroShimmer` (3s background-position sweep) keyframes/animations,
  `scale: 130` (1.3) and `transitionDuration: 600` (600ms).
- **`src/index.css`** — `@layer utilities` `.text-gradient-green/.text-gradient-blue`
  (gradient over `--positive`/`--accent` + `--accent-alt`, `background-size:200%`
  so `animate-hero-shimmer` has room to sweep, theme-safe via vars).
- **`server/__tests__/design-tokens.test.js` (NEW)** — contract test scanning
  live src for `kbl-*`, `animate-*` and `text-gradient-*` usage: every used
  name must exist in the config/`index.css`, and every `kbl-*` mapping must
  point to a CSS var that actually exists in `:root`. Self-updating coverage
  (unknown future kbl-* usage fails the suite). TDD: RED 1/4 → GREEN 4/4.

Gates: suite 177 → 181/181, `vite build` OK, puppeteer computed-style proof
(before: inherited `rgb(224,160,160)` → after: `rgb(192,57,43)` for
`text-kbl-red`; `bg-kbl-green` dots previously no-op now `rgb(46,139,87)`),
rendered CSS verified to contain the `bg-kbl-red`/`text-gradient-blue`
/`glowPulse` rules. Slice 2 (issue #1): migrate ~200 hardcoded hex values.

## 2026-10-20 — Phase 5: Vault Doctor — validating the vault the tolerant parser silently swallows

The reformalization audit's verdict on the finanzas layer was "robust against
absence, fragile against garbage": freshly cloned vaults loaded clean and any
malformed file degraded only its own source (phases 0–2 hardening), but the
tolerance itself is blind — a dropped row, a silently forced quantity or a
rounded-to-zero price never tells the operator WHICH file broke or WHY.
Phase 5 closes the whole reformalization plan (phases 0–5) with per-phase
hardening PLUS self-service diagnostics, answered by Vault Doctor (TDD strict:
21 RED tests → 21/21 GREEN after implementation, suite 146 → 167/167, vite
build OK).

**`server/lib/vault-doctor.mjs` (NEW) — `scanVault({vaultRoot, obsidianUrl?})`:**
a pure-ish, cache-free schema lint that re-reads the four finans zones fresh
(Compras, Patrimonio, Daily/food_sora, pau-agent `_wallet.json` — the zone
segments deliberately mirror the loader constants; both `finanzas-db.mjs` and
`finanzas-watcher.mjs` already carry keep-in-sync comments, now three places).
Only FILES IN EXPECTED ZONES are linted — unknown files stay invisible, same
trust boundary as the loaders. Rules mirror exactly what each loader would
swallow: missing/empty `producto::` → `missing_field` (error, with 1-based
line — the parser yields zero rows and the note does nothing); date without
plausible `YYYY-MM-DD` → `bad_date` (warn — cleanDate persists ANY raw string,
so `2026-10-99` is caught too via a shape + calendar-plausibility check);
price parsing to 0 while a `producto` exists → `suspicious_price` (warn,
message calls out the European comma tolerance `'0,40'` hits — the loader's
normalizeNumber rounds it to 0 and the row still inserts); non-numeric
`cantidad` → `bad_quantity` (warn — the loader silently forces qty 1, so the
exported `normalizeNumber` from `finanzas-db.mjs` is the discriminator,
ADDITIVE only); assets: missing `tipo`/`nombre` → `missing_field` (error —
parseAssetsFile returns null), `valor` 0 → `suspicious_value` (warn);
Daily: only Daily-looking files (dated name OR `_food_sora::` marker) count as
scanned, slot values not `H:MM`/`HH:MM` → `bad_slot_format` (warn with the
field name), duplicate date-from-filename across files → `duplicate_day`
(warn per extra file — INSERT OR REPLACE keeps only the last read); wallet:
broken JSON → `unreadable_file` (error), non-list `entries` or an entry
without concept/finite amount → `bad_entry` (error, one per bad entry,
mirroring loadWallet's acceptance criteria). Never throws: total scan failure
degrades to a zeroed scan + diagnostics, line numbers are 1-based, and every
finding carries `obsidian_url` (Phase 1 helper, injectable) for the
provenance deep-link.

**`server/routes/vault-doctor.mjs` (NEW, registered in the routes barrel):**
thin router, `GET /api/vault-doctor` → `200 {ok:true, scanned, findings,
diagnostics}`. `await ensureDb()` populates the runtime per-source status
(DB loader + chokidar watcher, `getInitDiagnostics()`) so the page shows WHAT
tolerance currently absorbed AND what the runtime believes. Cost tradeoff,
documented in the route: the scan runs PER REQUEST on fresh file reads —
the vault is the SSOT (same contract as `/api/todos` toggles); O(files in
the four zones) is fine for an audit page.

**`server/lib/finanzas-db.mjs`** — single additive export: `normalizeNumber`
(was module-private) so the lint discriminates non-numeric values with the
SAME normalization the loader applies; no behavior change.

**`src/types.ts` + `src/api/vault.ts` + `src/components/VaultDoctorDashboard.tsx`
(NEW) + nav wiring:** `VaultDoctorResponse`/`VaultDoctorFinding` types
(`line` is 1-based here, unlike TodoItem's 0-based heading index — documented
in the type), `fetchVaultDoctor()` in the existing vault domain barrel, and a
new screen: summary header (archivos auditados per zone), findings grouped by
file with the Food Sora filled-dot severity language (red/amber/green), the
"Open in Obsidian ↗" provenance chip per file row, runtime sources panel, the
tolerance note surfaced verbatim, Spanish empty state ("Todos los archivos
del vault pasan la validación") and skeleton while scanning. Tab `doctor`
registered exactly like its siblings: `useAppStore` union, Sidebar 🩺 entry
under Referencia, `page-meta` title/desc, App.tsx screen switch.

## 2026-10-20 — Phase 4: todos write-back — toggling a task edits the SSOT surgically

The TODO view was strictly read-only: the operator could SEE `_PENDING.md`
rows on the dashboard but the only way to close one was to edit the file by
hand in Obsidian. Phase 4 closes the loop (TDD strict: 11 RED tests collapsing
to 13 after fixes before any implementation, suite 133 → 146/146, vite build
OK): a toggle from the dashboard writes back ONE state-marker edit into
`_PENDING.md`, keeping the markdown byte-surgical and the SSOT rule intact —
any external reader (Obsidian itself, CLI mirrors like the removed
`todo-crud.mjs`) keeps seeing the same file.

**`server/application/use-cases/vault-todos.js` (extended):**

- Additive parse change: each section item now carries `line` — the 0-based
  index of its `##` heading inside the file. Rationale: duplicate titles
  exist, so line-based targeting beats content matching; CRLF normalization
  never changes the line count, so indices map 1:1 onto the raw bytes.
  `getTodos` exposes it; existing consumers are untouched.
- NEW `toggleTodo(itemRef)` — itemRef `{id}` and/or `{line}` (the UI sends
  both). Fresh read every call (no cache: Obsidian can change the file
  between renders). Resolution: exact `line` match first, verified against
  `id` when present; a stale line falls back to id search; id-only with 0
  matches → `'todo not found'`, with several → `'ambiguous todo match'`
  (both surface as 404-style `{"error"}`).
- IMPORTANT FORMAT REALITY (deviation from the checkbox-only plan):
  `_PENDING.md` in this vault is SECTION-based (`## Title` + `**Estado:**`,
  with some sections ALSO carrying an Obsidian-native `- [ ]`/`- [x]` line).
  So exactly one done-marker per item is flipped, preferring the checkbox:
  1. checkbox line inside the item's span → ONLY the bracket chars change
     (`[ ]` ↔ `[x]`), prose/priority/tags/lines untouched;
  2. otherwise the `**Estado:**` line → ONLY the value segment changes
     (done-family ↔ `todo`; a two-state checkbox semantic over the Estado
     field), prefix and trailing whitespace (including `\r`) preserved.
  A toggle from `in-progress` lands as `done`; re-toggling reopens as
  `todo` (the previous intermediate state is intentionally not restored —
  a checkbox has two states).
- Atomicity: the new content is written to `_PENDING.md.tmp` in the same
  directory and `fs.renameSync` replaces the original — a crash mid-write
  can never leave a half-flipped file; the tmp file is cleaned up on
  failure. One documented retry of the read+match+flip+write cycle on
  transient I/O errors (targeting errors are deterministic and return
  immediately).

**`server/routes/todos.mjs`:** `POST /api/todos/toggle` — body `{id, line}`;
400 on a body without id/line (mirroring the capture route's validation
guard style), 404 for not-found/ambiguous/missing `_PENDING.md` (the file
is never re-created by a toggle), 200 `{ok, item, sources, toggled}` on
success — `sources` carries the provenance `{file, obsidian_url}` shape.
**GET response shapes unchanged** (only the additive `line` field).

**`src/api/vault.ts` + `src/types.ts` + `src/components/TodosDashboard.tsx`:**
`toggleTodo({id, line})` typed; `TodoItem` gains optional `line`;
`TodoToggleResponse` typed. UI strategy chosen on purpose: INTEGRATE the
server-returned item into local state (no full refetch per toggle) — the
row is already byte-aligned with the SSOT after the server re-parses, and
navigating away/back re-runs the mount fetch so counts re-sync. Visual
state maps `state === 'done'` (the parser has no separate done/completed
field). Each row grew a checkbox-style toggle button (`aria-label "Toggle
todo"`), disabled while in-flight; failures show an inline `!` (console
warning, no toast infra) and the button itself is the retry affordance.
The phase-1 "Open _PENDING.md ↗" chip is untouched.

**Tests (`server/__tests__/todos-writeback.test.js`, 13):** temp vault
provenance harness + real app via supertest. Pins: parser `line` (4/12
headings); Estado toggle changes EXACTLY one line in bytes (line-array
diff `[6]`), GET reflects it live, toggle-back symmetric; checkbox toggle
diff `[18]` with `[x]` ↔ `[ ]` and the duplicate-title section
byte-identical; already-done item reopens; id-only on duplicate titles →
404 `ambiguous todo match` with the file untouched; `{id, line}` flips
each side exactly once; unknown id → 404; empty body → 400; missing
`_PENDING.md` → clean 404 without re-creating it; no `.tmp` leftovers.

## 2026-10-20 — Phase 3: capture triage — the CAPTURE flow writes to the CORRECT vault location, structured fields

`POST /api/capture` HARDCODED one destination
(`02 - APRENDIZAJE/MoureDev-Master/_campus/_inbox/<slug>.md`) for EVERY
entityType: a compra captured from the dashboard landed somewhere the
finanzas watcher never watches, a food slot could never reach a Daily
note, and the UI footer claiming "00 - INBOX" was simply a lie. Phase 3
fixes the WRITE side of the loop so a dashboard capture lands exactly
where its reader (watcher / pipeline) expects it (TDD strict: 18 RED
tests before any implementation, suite 115 → 133/133, vite build OK).

**`server/application/use-cases/capture-note.js` (extended):**

- `resolveDirectory(entityType)` triage table: `compra` →
  `<VAULT_ROOT>/02 - AREAS/008 - Trazabilidad Compras/Compras/`,
  `food` (+ aliases `comida`, `food-sora`) → `<VAULT_ROOT>/05 -
  JOURNAL/Daily/`, default (incl. `quick-capture` and any unknown
  entity id) → `<VAULT_ROOT>/00 - INBOX/` (auto-created — the UI copy
  finally becomes true).
- Consumption path (`compra`) keeps the seed-convention filename
  `<date>_<slug.comercio>.md` and writes the EXACT inline-field block
  the finanzas parser consumes: `fecha:: / comercio:: / producto:: /
  cantidad:: / precio_total:: / categoria::` + `# <producto>` under an
  `entity_type:: compra` frontmatter. Producto falls back to the first
  content line. No `Quick Note` leftovers.
- Food path gains `upsertDailyInlineField(date, fieldKey, value)`:
  missing Daily note → created with `# Diario` header + the field
  line; existing note → ALL lines of that field removed, ONE clean
  `<fieldKey>:: <value>` line appended — making
  `parseFoodSoraFile()`'s last-non-empty-match rule deterministic.
  Slot validation (`madrugada…noche`, `${slot}_food_sora`) rejects
  garbage with a clean 400-class error.
- Payload gains optional `fields` + `date` (YYYY-MM-DD); the legacy
  2-arg shape and the ORIGINAL default template stay byte-compatible,
  and callers without the vault port keep the legacy contentStore
  behavior untouched.
- Return contract on ALL triaged kinds:
  `{ path: <vault-relative>, obsidian_url: obsidian://... }` — deep
  link built by the injected `obsidianUrl` helper (phase 1 wiring).

**`server/di-container.js`:** `captureNote` receives `vaultFsApi` as
the new `vault` port (VAULT_ROOT + fs helpers + obsidianUrl — same
injection shape the vault-* use cases already had). `contentStore` and
`eventBus` stay.

**`server/routes/capture.mjs`:** payload passes through untouched;
validation errors of the triage map to **400 with a clear message**
(ValidationError code), so a compra without `comercio`+`producto`
or a food slot with an invalid `slot` can never crash — missing
`content` without fields keeps the existing 400. `/api/capture/batch`
supports the same per-item triage; plain items keep prior behavior.

**`src/api/vault.ts` + `src/components/QuickCapture.tsx`:**
`sendCapture(content, source, entityType?, fields?, date?)` typed;
the FAB modal now reveals per-type structured inputs — compra:
Comercio (required, names the ticket), Precio (RAW string, '42,75',
parsed server-side), Categoría (optional); producto = textarea first
line ("¿Qué compraste?" placeholder). food: slot select (Madrugada…
Noche), hora (time input, defaults to now) + date (defaults today).
Save feedback REPLACES the plain "✓ Guardado": a `✓ <type> guardado
en <vault-relative path>` line plus the provenance chip **"Abrir en
Obsidian ↗"** (`target=_blank rel=noopener noreferrer`, same chip
style as phase 1). The footer destination copy is now computed per
type (`00 - INBOX/` / `.../Compras/` / `05 - JOURNAL/Daily/`) —
what the UI claims is what actually happens.

**Demo loop (verified live on PORT=3007 against a demo-vault copy):**
capture a compra with `{comercio: Mercadona, precio_total: 42,75}` →
the file APPEARS at `Compras/2026-10-20_mercadona.md` with the exact
parser format → the chokidar watcher re-indexes it live (`compras
'2026-10-20_mercadona.md' re-indexed (1 items)`, ~1.5s after the
write) → `/api/search?q=…` shows the product at precio_total 43
(European comma parsed) with `archivo` + `obsidian_url` provenance →
the modal shows the feedback line + "Abrir en Obsidian ↗" deep link.
Food equivalent: `{slot: manana, hora: 08:30}` → `Daily/2026-10-20.md`
created → `/api/food-sora` shows `Mañana 08:30`; a second capture with
`09:10` REPLACES the slot through the same live loop.

**Tests (`server/__tests__/capture-triage.test.js`, 18):** temp-vault
harness (provenance mechanics + real app). Pins: triage table +
aliases; quick-capture dirs auto-created in a fresh vault; compra
EXACT inline content; first-line producto fallback; compra validation
(no fields / no producto → 400-class, never a write); food create +
REPLACE semantics with other slots surviving; invalid slot rejection;
finanzas DB roundtrip proving watcher-compatibility (42,75 → 43);
HTTP contract (`path` + `obsidian_url` on every success, 400s without
crashes) and batch triage.

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

## 2026-11-06 — Algorithms slice 3: non-comparison sorts (Counting + Radix) complete the switcher (TDD)

Issue: KaalNotFound/kbl-admin#2 (final slice). Branch: `feat/algorithms-counting-radix`.

**What:**

- `src/algorithms/counting.js`: Counting Sort frame engine with a genuinely
  different visual contract — phase 1 ("cuenta fase") swaps the render array
  for the BINS view (k = max+1 bars, one per value) while a note names the
  input value being counted; phase 2 ("colocación") rebuilds the array
  left-to-right by walking the bins in value order. `comparisons` counts reads
  (n), `swaps` counts placements (n) — reused counters, no UI changes needed.
- `src/algorithms/radix.js`: LSD Radix Sort base 10, one announced pass per
  decimal digit (`digit-pass`), per-read digit frames
  (`dígito <unidades/decenas/centenas> de valor v = k → cubeta k`), then
  stable bucket collection frames. Digit count derives from the max value.
- `AlgorithmsDashboard`: two new tabs — '🔢 Counting Sort', '🌌 Radix Sort'
  (8 total). Meta cards render via the existing machinery.
- `SortVisualizer`: a minimal `nonNegative` meta guard (~8 lines) rejects
  negative input for counting/radix with a clean Spanish error, instead of
  generating broken frames. `frameTypes` AlgorithmMeta typedef documents the
  optional flag. Zero changes to the bars/controls rendering — the phase
  labels ride entirely on existing `line`/`description`/`comparisonText`.

**Behavior decision (negatives/floats):** `parseArray` already rejects floats
("no es un número entero"). Negatives remain valid for comparison sorts, so
instead of a global restriction the two non-comparison metas declare
`nonNegative: true` and the shared player enforces it per-algorithm at
generation time. Covered by a test.

**Gates:** suite 208 → 225/225 green (17 new, `server/__tests__/counting-radix.test.js`:
final frame equals integer-sorted input for sizes 1/8/20 incl. duplicates,
zeros and 0..999; cuenta/digit frames present; counters sane; purity;
nonNegative decision). `npx vite build` OK.

**Runtime proof** (puppeteer-core + /usr/bin/chromium --no-sandbox, API on
PORT=3007 + vite on 5177 via `VITE_API_PORT`; ports killed afterwards):
all 8 tabs switch with `bg-accent` on the active pill; play → "Algoritmo
terminado" with comparaciones=5 / intercambios=5 > 0 on both new algorithms.
Screenshots: `/tmp/opencode/algo3-counting.png`, `/tmp/opencode/algo3-radix.png`.

### Visualizer layout: side-by-side execution point + didactic counters

**Status:** complete (layout feedback round)

**Layout.** `SortVisualizer` main row is now two cards side by side:
`Visualización` (left, `flex-[55]`) and `Punto de ejecución` (right,
`flex-[45]`). The pseudo-code panel grows naturally — no vertical scroll even
for the tallest 9-line code (counting.js). The didactic counters card, the
per-algorithm aside panel and the big-O table moved to a secondary row below.

**Didactic counters.** `Contadores en vivo` became `Contadores del algoritmo —
guía didáctica`: the two values stay visible with `tabular-nums`, each row
carries a tooltip that defines the metric ("comparar dos valores para decidir
cuál es mayor", "mover valores físicamente") and a paragraph explains that each
increment happens in lock-step with the highlighted code line, the bar colors
and the Big-O summary — and why comparison sorts pay in comparisons (O(n²))
while counting/radix pay in reads/placements. Optional `counterLabels` on
`AlgorithmMeta` relabels the two rows to `Lecturas` / `Colocaciones` for the
non-comparison sorts.

**Verification.** Suite 228/228, `vite build` OK. Puppeteer probes: at 1440px
and 800px the two cards share the same row (`sideBySide: true`), pseudo panel
`scrollHeight <= clientHeight` (no vertical scroll), all 8 tabs render a
non-empty execution point (4–9 lines). After 3 "Siguiente paso" clicks the
bubble counters read comparaciones=2 / intercambios=1; radix shows
lecturas=2 / colocaciones=0 mid-run.

### Security slice 5: supply chain audit gate, SHA-pinned CI, self-hosted fonts

**Status:** complete (issue KaalNotFound/kbl-admin#3, OWASP A03 + CI hardening)

**Dependencies.** `npm audit fix` (non-forced) cleared all high/critical prod
vulns (ip-address via express-rate-limit, proxy-addr critical, zod via
chromium-bidi/puppeteer-core). One moderate pair survived: `qs@6.15.4` pinned
by express@4.22.2 (`~6.15.1` caps below the patched 6.16.1), and qs sits in
the express query-parsing runtime path — not acceptable to leave. Fixed with
an exact `overrides: { "qs": "6.16.2" }` (the same version body-parser already
resolves, so the tree dedupes to a single copy). `npm audit --omit=dev` is now
0 vulnerabilities. Remaining dev-only vulns (tinypool critical inside vitest,
vite/esbuild moderate) require breaking major upgrades (vitest@5, vite@8) —
out of scope, they never ship to server runtime; documented here instead.

**CI hardening.** `actions/checkout` and `actions/setup-node` are SHA-pinned
(`# v4` comment; mapping verified via `git ls-remote` refs/tags/v4) and a new
gate step runs `npm audit --omit=dev --audit-level=high` right after `npm ci`,
failing the job on any new high/critical prod advisory before tests run.
Same ubuntu/node matrix as before; runnable locally via the new
`npm run audit:prod` script.

**Fonts.** The Google Fonts stylesheet link (Atkinson Hyperlegible, Inter,
JetBrains Mono) was the only external third-party origin. Fonts are now
self-hosted in `public/fonts/` (8 woff2 files, 248 KB, latin+latin-ext
subsets — enough for es-AR). `fonts.css` preserves Google's exact @font-face
blocks (family names, weights, unicode-range); Inter and JetBrains Mono are
the same variable-font files Google served, Atkinson stays static. Rendering
should be pixel-identical; the app now works fully offline and no SRI hashes
are needed (same-origin only).

**Gates:** `npx vitest run` 293/293 (286 baseline + 7 new in
`server/__tests__/security-supply-chain.test.js`: audit exit 0, SHA-pinned
actions, audit gate present, zero external font origins, local woff2 present,
fonts.css url() check). `npx vite build` OK. `npm audit --omit=dev
--audit-level=high` exits 0.

## 2026-11-09 — Security slice 6: publish hygiene — untrack personal artifacts, sanitize paths (issue #3)

Pre-publication data-leak sweep of tracked contents.

- Untracked and deleted `server/_MARKET_DATA.json` (personal data snapshot)
  and `server/cdp-helper.mjs.bak` (dead backup). `server/routes/market.mjs`
  now resolves its data file from `KBL_DATA_DIR` (default `server/data/`,
  gitignored) as `market-data.json`, matching the other JSON stores; the
  endpoint keeps its empty-payload fail-safe when the file is absent.
- `.gitignore` gained `.atl/`, `*.bak`, and `server/_MARKET_DATA.json` so
  local agent traces and backups can never be committed accidentally.
- Sanitized the single tracked personal absolute path (a test fixture string
  in `security-exceptions-logging.test.js`) to a tmpdir-style path; email and
  Windows-path scans over tracked text came back clean.
- New `server/__tests__/security-publish-hygiene.test.js` (4 tests) guards
  this permanently: no tracked `*.bak`/market snapshot, zero personal-path
  matches across tracked text files, ignore rules present, market data path
  env-configurable. README gained a factual `## Security` summary.
- `docs/screenshots/*.png` are real UI captures that cannot be scanned
  textually — flagged for manual visual review before going public.

**Gates:** `npx vitest run` 297/297 (293 baseline + 4 new), `npx vite build`
OK, `npm run audit:prod` exits 0.

## 2026-11-09 — Security slice 7a: route registry lock against shadowing and orphans (issue #3)

Closes the OWASP API9 residual: nothing prevented an unmounted router file or
a duplicated method+path registration from silently shadowing an endpoint.

- New `server/__tests__/security-route-registry.test.js` walks the 21 live
  router stacks (`apiRouters[i].stack`) and asserts: router count equals
  route files on disk (20 in `server/routes/` + `../_finanzas.mjs` = 21, so a
  new orphan file fails until mounted), >80 distinct method+path keys, zero
  duplicate keys across routers, and only real HTTP methods declared.
- Lock test by construction: green on first run (no defect existed to fix);
  it pins the invariant going forward.

**Gates:** `npx vitest run` targeted file 3/3 green.

## 2026-11-09 — Security slice 7b: per-route quotas for LLM and vault-scan endpoints (issue #3)

LLM04/resource-abuse residual: the global 500/min limiter is generous for
dashboard polling but does not protect the expensive NLM proxy calls,
the recursive ingest scan or the per-request vault-doctor scan.

- `createScopedRateLimiter({ windowMs, max, message })` in
  `server/middleware/security.mjs`: same wire behavior as the global limiter
  (draft-6 `RateLimit-*` headers, `legacyHeaders: false`) with a tighter
  quota and a JSON 429 carrying a Spanish message. Global defaults untouched.
- Quotas mounted: POST /notebooklm/ask 20/min, /content/generate 15/min,
  /notebooks/create 10/min, POST /active-recall/ingest 5/min (recursive FS
  scan), GET /vault-doctor 10/min (full vault scan per request).
- Free-text caps via new `server/lib/nlm-guard.mjs` (8000 chars):
  `question` on /ask, `name` on /notebooks/create, `prompt` on
  /content/generate — absent fields untouched, numeric/id fields untouched.
  Oversized payloads get 400 before reaching the proxy.
- New `server/__tests__/security-scoped-rate.test.js` (6 tests): limiter
  contract (429 + Spanish message + RateLimit-* headers), guard units, real
  router integration (400 on oversized question; 429 on the 21st /ask call
  within a minute) and stack introspection proving each expensive route has
  a limiter before its handler. Two RED findings fixed: draft-6 header names
  (not X-RateLimit-*) and module-scoped quota stores shared across tests
  (resetModules per test).

**Gates:** `npx vitest run` full suite green, `npx vite build` OK.

## 2026-11-09 — Pre-deploy slice: YAGNI deletions and dead params (issue #4, B4/B7)

Two payloads of dead code removed after the ADR-025 torre migration proved
they were unreferenced:

- **Legacy behavioral trio deleted** (`server/lib/behavioral-tracker.mjs`,
  `behavioral-session.mjs`, `behavioral-reports.mjs`, ~300 LOC). Verified:
  zero importers anywhere (prod, tests, shared_kernel) — the application
  use-case `behavioral.js` migrated their logic verbatim and its header
  still claiming "the barrel stays for backward compat" is updated. Root
  cause: the migration note was never cleaned, so the barrel looked load-
  bearing when it wasn't.
- **`feedFromActiveRecall` deleted** from `server/lib/mastery-store.js`.
  It was exported but never wired: the auto-feed from active recall
  submissions it promised does not exist in any prod path (DI injects only
  the 5 functions the mastery use-case consumes). YAGNI — if the feature is
  ever wanted, it needs real wiring first, not an unused export. Its 4 tests
  were removed with it.
- **`calcNextReview(interval, score, previousScore)`**: the third param was
  never read inside the function; dropped from signature + call site.
- **`catch (err) { throw err }` in BraveCdpAdapter#connect**: dead wrapper.
- **`finanzas-db.mjs`**: the five constant field regexes in
  `parseFoodSoraFile` were rebuilt per parsed file (`new RegExp` x5) —
  hoisted to module scope (`FOOD_SORA_FIELDS/LABELS/REGEXPS`). Reuse of /g
  regexes with `matchAll()` is spec-safe (it clones; lastIndex never
  advances on the original) and is defensively reset before each use.

**Gates:** `npx vitest run` full suite green.

## 2026-11-09 — Pre-deploy slice: dialog semantics, focus management, finance dark canvas (issue #4, C2+C4)

Accessibility pass over the shared modal pattern and the finance tab trio:

- **APG dialog semantics** (`QuickCapture`, `InventoryDashboard` add-item):
  `role="dialog"` + `aria-modal` + `aria-labelledby` on the panel, container
  scoped Escape (QuickCapture's Escape lived on the textarea only), Tab
  trap cycling at both ends, first-input focus on open, and focus restored
  to the opener on every close path. Shared logic in
  `src/components/ui/dialogKeyboard.ts`; per-component opener refs drive
  restore via a small `wasOpen` effect.
- **Icon-only buttons** got accessible names: QuickCapture FAB ("Captura
  rápida") and both ✕ closers ("Cerrar"), ShadowStudy ↻ ("Recargar
  estadísticas").
- **sr-only labels** wired via htmlFor/id: Compras search input + store
  select, QuickCapture structured compra (comercio/precio/categoría) and
  food (franja/hora/fecha) fields.
- **Keyboard**: ShadowStudy flashcard `role="button"` div now accepts Space
  alongside Enter; global `:focus-visible` ring added in index.css using
  the existing `--accent` token (no new colors).
- **Finance trio contrast (C2, WCAG 1.4.3)**: the tab was designed on a warm
  dark canvas but hardcoded text hexes (`#c8b8a8`, `#a0907e`, `#e0a0a0`,
  `#f0e5d8`) sat on the global light-theme white at ~1.9:1. Fix preserves
  the intended look with a scoped `.fin-dark` class (index.css) that pins
  the trio's design palette as CSS vars regardless of global theme; raw
  text hexes replaced by the existing token utilities
  (`text-text-primary/secondary/tertiary`, `text-danger`, `bg-warning`,
  `bg-text-tertiary`). Charts keep their JS hex fills — they sit on the
  now-pinned dark canvas in both themes. Error banners render a dark
  `bg-page/95` chip inside `.fin-dark` (light-theme text was 2.2:1);
  badge hue follows `--danger` (#e08a7a family, the trio's own red).

**Gates:** `npx vitest run` 330/330 green (+7 new modal/label tests), `npx vite build` OK.

## 2026-11-09 — Pre-deploy slice: mobile grid floors and scrollable tables (issue #4, C3)

Every dashboard grid listed in the issue now has a mobile floor before its
step-up breakpoint (grids of 3-5 columns no longer render 60px-wide cells on
phones): `grid-cols-2 sm:grid-cols-5` StudyHashmap stats,
`grid-cols-2 sm:grid-cols-4` TodosDashboard + Integrations + CognitiveDebt
skeletons/metrics, `grid-cols-2 sm:grid-cols-3` SystemLogs / BiasRadar /
EntityTypes / Queue / Projects, and `grid-cols-1 sm:grid-cols-2` for the
SocraticAudit strengths/gaps lists (text lists read better stacked).
StudyDashboard's top grid (drifted from issue's line 42 to 104) already
floored at `grid-cols-2 md:grid-cols-4` — untouched. The Study notes table
(line 156-201) now sits in an `overflow-x-auto` wrapper (was
`overflow-hidden`, which clipped the Modificado column on phones); the
finance/search tables already had their wrappers.

**body{overflow-x:hidden} kept**: after the table wraps, nothing text-bearing
relies on the clip, but the finance heroes' decorative glow circles
(`absolute -top-2/5 -right-1/5 w-[300px]`, animate-glow-pulse) extend past
their cards by design and would reintroduce horizontal viewport scroll.
Removing the rule would need per-card overflow guards that visibly crop the
glow — not accepted for this slice.

Covered by a source-level structure test (`responsive-grid.test.ts`) rather
than rendering ten fetch-heavy dashboards — CSS-only changes, cheap guard
against floor regressions.

**Gates:** `npx vitest run` 333/333 green (+3 structure tests), `npx vite build` OK.
