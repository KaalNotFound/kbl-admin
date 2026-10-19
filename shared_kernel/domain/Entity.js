/**
 * Entity — Base class for domain entities.
 * Identity is the id field (UUID or content hash).
 */
export class Entity {
  #id;
  #createdAt;

  constructor(id, createdAt = new Date()) {
    if (!id) throw new Error('Entity requires an id');
    this.#id = id;
    this.#createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  }

  get id() { return this.#id; }
  get createdAt() { return this.#createdAt; }

  equals(other) {
    if (!other || !(other instanceof Entity)) return false;
    return this.#id === other.#id;
  }
}
