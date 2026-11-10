/**
 * Route Barrel — All API routes in one place.
 * Extracted from server/index.js for SRP compliance.
 *
 * Usage:
 *   import { apiRouters } from './routes/index.mjs';
 *   for (const router of apiRouters) app.use('/api', router);
 */
import overviewRouter from './overview.mjs';
import queueRouter from './queue.mjs';
import projectsRouter from './projects.mjs';
import entityTypesRouter from './entity-types.mjs';
import inventoryRouter from './inventory.mjs';
import captureRouter from './capture.mjs';
import contextRouter from './context.mjs';
import pomodoroRouter from './pomodoro.mjs';
import braveRouter from './brave.mjs';
import whatsappRouter from './whatsapp.mjs';
import ankiRouter from './anki.mjs';
import studyRouter from './study.mjs';
import activeRecallRouter from './active-recall.mjs';
import marketRouter from './market.mjs';
import notebooklmRouter from './notebooklm.mjs';
import masteryRouter from './mastery.mjs';
import behavioralRouter from './behavioral.mjs';
import todosRouter from './todos.mjs';
import globalSearchRouter from './global-search.mjs';
import vaultDoctorRouter from './vault-doctor.mjs';

// Note: finanzasRouter is in server/finanzas-router.mjs (not in routes/)
import finanzasRouter from '../finanzas-router.mjs';

export const apiRouters = [
  overviewRouter,
  queueRouter,
  projectsRouter,
  entityTypesRouter,
  inventoryRouter,
  captureRouter,
  contextRouter,
  pomodoroRouter,
  braveRouter,
  whatsappRouter,
  ankiRouter,
  studyRouter,
  activeRecallRouter,
  marketRouter,
  finanzasRouter,
  notebooklmRouter,
  masteryRouter,
  behavioralRouter,
  todosRouter,
  globalSearchRouter,
  vaultDoctorRouter,
];
