/**
 * AggregateRoot — Entity with domain event collection.
 * Events are collected during a transaction and published after commit.
 */
import { Entity } from './Entity.js';
// NOTE: domainEvents stored as plain objects, not entities

export class AggregateRoot extends Entity {
  #domainEvents = [];

  get domainEvents() { return [...this.#domainEvents]; }

  addDomainEvent(event) {
    this.#domainEvents.push({
      ...event,
      occurredAt: event.occurredAt || new Date(),
      aggregateId: this.id,
    });
  }

  clearEvents() {
    this.#domainEvents = [];
  }
}
