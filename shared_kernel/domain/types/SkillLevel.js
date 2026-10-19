/**
 * SkillLevel — Discrete mastery level 0-4.
 * 0=new, 1=familiar, 2=competent, 3=proficient, 4=expert
 */
import { ValueObject } from '../ValueObject.js';
import { ValidationError } from '../Result.js';

const LEVELS = [0, 1, 2, 3, 4];
const LABELS = ['new', 'familiar', 'competent', 'proficient', 'expert'];

export class SkillLevel extends ValueObject {
  validate(value) {
    if (!LEVELS.includes(value)) {
      throw new ValidationError(`SkillLevel must be one of: ${LEVELS.join(', ')}`, 'level');
    }
  }

  get label() { return LABELS[this.value]; }
  get isExpert() { return this.value === 4; }
  get isCompetentOrAbove() { return this.value >= 2; }

  /** @param {SkillLevel} other */
  isHigherThan(other) { return this.value > other.value; }
}
