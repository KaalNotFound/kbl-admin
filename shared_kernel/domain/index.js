/**
 * shared_kernel/domain — Barrel export.
 * Import everything from here: import { Result, ValidationError, ConceptName } from '../shared_kernel/domain/index.js';
 */

// Base classes
export { Result, DomainError, ValidationError, NotFoundError, ConcurrencyError, InfrastructureError } from './Result.js';
export { Entity } from './Entity.js';
export { AggregateRoot } from './AggregateRoot.js';
export { ValueObject } from './ValueObject.js';

// Types (Value Objects)
export { ConceptName } from './types/ConceptName.js';
export { MasteryScore } from './types/MasteryScore.js';
export { SkillLevel } from './types/SkillLevel.js';
export { ConceptHash } from './types/ConceptHash.js';
export { QuizResult } from './types/QuizResult.js';
export { EntityType } from './types/EntityType.js';

// Ports (Interfaces)
export { ContentStore } from './ports/ContentStore.js';
export { MasteryStore } from './ports/MasteryStore.js';
export { EventBus } from './ports/EventBus.js';
export { BraveBrowserPort } from './ports/BraveBrowserPort.js';

// Mastery domain helpers (DRY 2026-08-01: antes 3 imports directos a
// _mastery-domain.js duplicados en submit-quiz-review, submit-active-recall-review, test.mjs)
export { computeMastery, getLevelFromScore } from './_mastery-domain.js';
