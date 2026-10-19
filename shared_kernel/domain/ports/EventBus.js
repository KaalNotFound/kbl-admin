/**
 * @interface EventBus
 *
 * Port for publishing domain events.
 * Implementations: OutboxEventBus, ConsoleEventBus (testing/dev).
 *
 * Domain events are published AFTER domain logic succeeds but BEFORE
 * the response is sent. The Outbox implementation persists them in the
 * same transaction as business data for eventual consistency.
 */
export class EventBus {
  /**
   * @param {{type: string, aggregateId: string, payload: object, occurredAt?: Date}} event
   * @returns {Promise<Result<void>>}
   */
  async publish(event) {
    throw new Error('EventBus.publish must be implemented');
  }

  /**
   * @returns {Promise<Result<object[]>>}
   */
  async getPending() {
    throw new Error('EventBus.getPending must be implemented');
  }

  /**
   * Mark event as delivered.
   * @param {string} eventId
   * @returns {Promise<Result<void>>}
   */
  async markDelivered(eventId) {
    throw new Error('EventBus.markDelivered must be implemented');
  }
}
