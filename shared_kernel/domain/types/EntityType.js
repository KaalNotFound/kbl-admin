/**
 * EntityType — Classification of vault entities.
 * Values: 'study', 'project', 'concept', 'reference'
 */
import { ValueObject } from '../ValueObject.js';
import { ValidationError } from '../Result.js';

const VALID_TYPES = ['study', 'project', 'concept', 'reference'];

export class EntityType extends ValueObject {
  validate(value) {
    if (!VALID_TYPES.includes(value)) {
      throw new ValidationError(`EntityType must be one of: ${VALID_TYPES.join(', ')}`, 'entityType');
    }
  }

  get isStudy() { return this.value === 'study'; }
  get isProject() { return this.value === 'project'; }
  get isConcept() { return this.value === 'concept'; }
  get isReference() { return this.value === 'reference'; }
}
