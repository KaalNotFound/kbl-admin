/**
 * Dependency Injection — Wires infrastructure adapters into the application.
 *
 * This module replaces the direct imports in server/index.js with properly
 * wired adapters that implement Ports from shared_kernel/domain.
 *
 * Architecture:
 *   Domain (Ports) ← Application (Use Cases) ← Infrastructure (Adapters)
 *                         ↑                            ↑
 *                    DI Container (this file)     Adapter instances
 */

import path from 'path';
import { VaultFileSystemAdapter } from './infrastructure/vault-filesystem-adapter.js';
import { JsonFileMasteryStore } from './infrastructure/json-file-mastery-store.js';
import { OutboxEventBus } from './infrastructure/outbox-event-bus.js';
import { createLogger } from './infrastructure/structured-logger.js';
import { createSubmitQuizReview } from './application/use-cases/submit-quiz-review.js';
import { createCaptureNote } from './application/use-cases/capture-note.js';
import { createSubmitActiveRecallReview } from './application/use-cases/submit-active-recall-review.js';
import { createFinanzasUseCases } from './application/use-cases/finanzas.js';
import { createMasteryUseCases } from './application/use-cases/mastery.js';
// Torre study-data (2026-10-19): el servicio legacy de datos de estudio se
// re-monta como use-case con deps inyectadas — el router study.mjs consume
// req.useCases.studyData y NO importa lib/ (boundary §2.1). Resuelve la
// regresión: el frontend llama GET /api/study/data y el endpoint no existía.
import { createStudyDataUseCases } from './application/use-cases/study-data.js';
import * as studyService from './lib/study-service.mjs';
import { createQueueUseCases } from './application/use-cases/vault-queue.js';
import { createEntityTypesUseCases } from './application/use-cases/vault-entity-types.js';
import { createInventoryUseCases } from './application/use-cases/vault-inventory.js';
import { createOverviewUseCases } from './application/use-cases/vault-overview.js';
import { createProjectsUseCases } from './application/use-cases/vault-projects.js';
import { createContextUseCases } from './application/use-cases/vault-context.js';
import { createTodosUseCases } from './application/use-cases/vault-todos.js';
import { createPomodoroUseCases } from './application/use-cases/vault-pomodoro.js';
import { createNotebooklmUseCases } from './application/use-cases/notebooklm.js';
import { createActiveRecallUseCases } from './application/use-cases/active-recall.js';
import { createBraveUseCases } from './application/use-cases/brave.js';
import { createBehavioralUseCases } from './application/use-cases/behavioral.js';
import { createGlobalSearchUseCases } from './application/use-cases/global-search.js';
import { ensureDb } from './lib/finanzas-db.mjs';
import { calculateSummary, calculateInsights } from './lib/finanzas-reportes.mjs';
import { searchItems, compareItems } from './lib/finanzas-busqueda.mjs';
import { getFoodSoraStats, getFoodSoraData } from './lib/finanzas-food-sora.mjs';
import { calculateFinanzas } from './lib/finanzas-runway.mjs';
import { calculatePatrimonio } from './lib/finanzas-patrimonio.mjs';
// Torre mastery (ADR-025): el wiring inyecta el store legacy de mastery, los
// helpers de vault y el proxy NLM al use-case — los routers ya no importan lib/
import * as legacyMasteryStore from './lib/mastery-store.js';
import * as vaultFs from './infrastructure/vault-fs-adapter.mjs';
// Data provenance (Phase 1): obsidian:// deep-link builder exposed through the
// vault helper API so vault-* use-cases can annotate sources (no direct lib/
// imports inside the use-cases themselves).
import { obsidianUrl } from './lib/obsidian-url.mjs';
// Torre notebooklm (ADR-025): el port NLM es compartido por mastery (socrático)
// y notebooklm (proxy HTTP). El proxy solo importa http — safe para import estático.
import { nlmRequest, nlmHealth } from './lib/notebooklm-proxy.mjs';
// Torre active-recall (ADR-025): el store legacy de spaced repetition se
// inyecta como port al use-case — el router ya no lo importa directo.
import * as activeRecallStore from './infrastructure/active-recall-store.js';
// Torre brave (ADR-025): el adapter CDP (puppeteer-core) se inyecta como port
// al use-case — el router ya no lo importa directo (violación R1 resuelta).
import { BraveCdpAdapter } from './infrastructure/brave-cdp-adapter.js';

/**
 * Create and wire all infrastructure adapters.
 *
 * @param {object} [opts]
 * @param {string} [opts.vaultRoot] - Vault root directory (default: process.cwd())
 * @param {string} [opts.masteryStorePath] - Path to mastery JSON file
 * @param {string} [opts.outboxPath] - Path to outbox JSON file
 * @param {object} [opts.logger] - StructuredLogger instance
 * @returns {{ contentStore, masteryStore, eventBus, useCases, logger }}
 */
function createContainer(opts = {}) {
  const logger = opts.logger || createLogger({ service: 'kbl-admin' });

  // Infrastructure adapters
  const contentStore = new VaultFileSystemAdapter(opts.vaultRoot || process.cwd());

  const masteryStore = new JsonFileMasteryStore(opts.masteryStorePath || path.join(process.cwd(), 'data', 'mastery.json'));

  const eventBus = new OutboxEventBus(opts.outboxPath || path.join(process.cwd(), 'data', 'outbox.json'));

  // Torre vault-helpers (ADR-025): API de fs del adapter (vault-fs-adapter.mjs
  // vía barrel lib/) compartida por los use-cases vault-* (queue, entity-types,
  // inventory, overview, ...) — deps inyectadas, sin imports de lib/ en los use-cases.
  const vaultFsApi = {
    VAULT_ROOT: vaultFs.VAULT_ROOT,
    listDir: vaultFs.listDir,
    readFile: vaultFs.readFile,
    fileStat: vaultFs.fileStat,
    existsSync: vaultFs.existsSync,
    fileInfo: vaultFs.fileInfo,
    writeFile: vaultFs.writeFile,
    ensureDir: vaultFs.ensureDir,
    getQueueCounts: vaultFs.getQueueCounts,
    scanAreaRecursive: vaultFs.scanAreaRecursive,
    obsidianUrl,
  };

  // Torre notebooklm (ADR-025): port NLM compartido (request + health). El
  // use-case mastery también lo consume (evaluateSocratic → nlm.request).
  const nlm = { request: nlmRequest, health: nlmHealth };

  // Use cases — factory functions inject their own ports
  const useCases = {
    submitQuizReview: createSubmitQuizReview({ masteryStore, eventBus }),
    // Capture triage (phase 3): the use case receives vaultFsApi as the vault
    // port (VAULT_ROOT + fs helpers + obsidianUrl, phase 1 wiring) so notes
    // land in the watcher-owned dir per type instead of the hardcoded campus
    // inbox. Legacy contentStore kept for callers without the port.
    captureNote: createCaptureNote({ contentStore, eventBus, vault: vaultFsApi }),
    submitActiveRecallReview: createSubmitActiveRecallReview({ masteryStore, eventBus }),
    // Torre finanzas (ADR-025): el router _finanzas.mjs recibe la lógica por DI,
    // no importa lib/ directo (boundary §2.1). ensureDb = puerto de datos (I/O),
    // calc = funciones de cálculo — ambas inyectadas desde el wiring.
    finanzas: createFinanzasUseCases({
      ensureDb,
      calc: {
        calculateSummary,
        calculateInsights,
        searchItems,
        compareItems,
        getFoodSoraStats,
        getFoodSoraData,
        calculateFinanzas,
        calculatePatrimonio,
      },
    }),
    // Torre mastery (ADR-025): use-case con deps inyectadas (store legacy de
    // mastery, vault-helpers para extractVaultConcepts, proxy NLM para el
    // socrático). Reemplaza lib/mastery-service.mjs (eliminado) — los routers
    // mastery.mjs y study.mjs consumen req.useCases.mastery.
    mastery: createMasteryUseCases({
      store: {
        getAllMastery: legacyMasteryStore.getAllMastery,
        getConceptDetail: legacyMasteryStore.getConceptDetail,
        getSkillTree: legacyMasteryStore.getSkillTree,
        getBypassStatus: legacyMasteryStore.getBypassStatus,
        validateConcept: legacyMasteryStore.validateConcept,
      },
      vault: { studyPath: vaultFs.STUDY_PATH, collectStudyFiles: vaultFs.collectStudyFiles, readFile: vaultFs.readFile },
      nlm,
    }),
    // Torre study-data (2026-10-19): funciones del servicio de estudio
    // inyectadas como port — el router study.mjs expone GET /study/data,
    // GET /study/history y los POST de guardado vía req.useCases.studyData.
    studyData: createStudyDataUseCases(studyService),
    // Torre vault-helpers (ADR-025): use-case con deps del adapter de fs
    // (vault-fs-adapter.mjs vía barrel lib/). El router queue.mjs consume
    // req.useCases.queue — ya no importa lib/ directo.
    queue: createQueueUseCases({ vault: vaultFsApi }),
    // Torre vault-helpers (ADR-025): entity-types — scan recursivo entity_type::
    // + catálogo de entidades. El router entity-types.mjs consume
    // req.useCases.entityTypes — ya no importa lib/ directo.
    entityTypes: createEntityTypesUseCases({ vault: vaultFsApi }),
    // Torre vault-helpers (ADR-025): inventory — scan entity_type:: inventory_item
    // + creación de notas. El router inventory.mjs consume req.useCases.inventory
    // — ya no importa lib/ directo (bug listDir fijado: scan devolvía [] siempre).
    inventory: createInventoryUseCases({ vault: vaultFsApi }),
    // Torre vault-helpers (ADR-025): overview — stats de 8 áreas + logs de
    // sesión/térmico + health. El router overview.mjs consume
    // req.useCases.overview — ya no importa lib/ directo.
    overview: createOverviewUseCases({ vault: vaultFsApi }),
    // Torre vault-helpers (ADR-025): projects — scan 01 - PROYECTOS/ (stack de
    // package.json, status/description de README/AGENTS, stalled). El router
    // projects.mjs consume req.useCases.projects — ya no importa lib/ directo
    // (bug listDir fijado: scanProjectFiles recolectaba 0 archivos siempre).
    projects: createProjectsUseCases({ vault: vaultFsApi }),
    // Torre vault-helpers (ADR-025): context — _PENDIENTES.md/_ROADMAP.md/
    // CHECKPOINT_*.md + session/thermal/capture logs. El router context.mjs
    // consume req.useCases.context — ya no importa lib/ directo (bug listDir
    // fijado: /context devolvía 500 siempre, capture_logs=[] siempre).
    context: createContextUseCases({ vault: vaultFsApi }),
    // Torre vault-helpers (ADR-025): todos — _PENDING.md (SSOT) + métricas de
    // logs (exception/session/operational) + mermaid graph. El router todos.mjs
    // consume req.useCases.todos — ya no importa lib/ directo (usa solo
    // VAULT_ROOT + readFile + scanAreaRecursive).
    todos: createTodosUseCases({ vault: vaultFsApi }),
    // Torre vault-helpers (ADR-025): pomodoro — estado del timer compartido con
    // la overlay chrono-suite (timer-state.json). El router pomodoro.mjs consume
    // req.useCases.pomodoro — ya no importa lib/ directo (solo VAULT_ROOT +
    // ensureDir + writeFile + existsSync + readFile).
    pomodoro: createPomodoroUseCases({ vault: vaultFsApi }),
    // Torre notebooklm (ADR-025): proxy NLM vía port inyectado — el router
    // notebooklm.mjs consume req.useCases.notebooklm, ya no importa lib/ directo.
    notebooklm: createNotebooklmUseCases({ nlm }),
    // Torre active-recall (ADR-025): store legacy inyectado como port — el
    // router active-recall.mjs consume req.useCases.activeRecall, ya no importa
    // #infra directo (violación R1 resuelta; bug fix: /review usaba el path DI
    // desalineado de mastery → 500; ahora delega al legacy que funcionaba).
    activeRecall: createActiveRecallUseCases({
      defaultIngestDir: vaultFs.ACTIVE_RECALL_DIR,
      store: {
        getDueQuestions: activeRecallStore.getDueQuestions,
        getDueWithStats: activeRecallStore.getDueWithStats,
        submitReview: activeRecallStore.submitReview,
        getStats: activeRecallStore.getStats,
        getAllQuestions: activeRecallStore.getAllQuestions,
        getQuestion: activeRecallStore.getQuestion,
        ingestFromActiveRecall: activeRecallStore.ingestFromActiveRecall,
        seedQuestions: activeRecallStore.seedQuestions,
      },
    }),
    // Torre brave (ADR-025): adapter CDP inyectado como port — el router
    // brave.mjs consume req.useCases.brave, ya no importa infra directo
    // (la cache TTL + retry viven en el use-case, no en el router).
    brave: createBraveUseCases({ brave: new BraveCdpAdapter() }),
    // Torre behavioral: use-case con estado in-memory + store persisted
    // (behavioral-log.json) vía vault helpers inyectados. El router
    // behavioral.mjs consume req.useCases.behavioral — ya no importa
    // lib/ directo (violación R1 ca-boundaries resuelta; FIX de path:
    // el legacy construía el store path mal → reports vacíos silenciosos).
    behavioral: createBehavioralUseCases({ vault: vaultFsApi }),
  };

  // Torre global-search: búsqueda transversal (notas del vault, proyectos,
  // conceptos mastery, TODOs, entity catalog) para la palette del TopBar
  // ("Buscar... Ctrl+K"). Se construye post-asignación para reutilizar los
  // use-cases ya creados — sin duplicar wiring.
  useCases.globalSearch = createGlobalSearchUseCases({
    vault: vaultFsApi,
    projects: useCases.projects,
    todos: useCases.todos,
    mastery: { getAllMastery: legacyMasteryStore.getAllMastery },
    entities: useCases.entityTypes,
  });

  return { contentStore, masteryStore, eventBus, useCases, logger };
}

export { createContainer };
