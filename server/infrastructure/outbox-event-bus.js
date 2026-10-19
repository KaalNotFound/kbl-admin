/**
 * OutboxEventBus — Implements EventBus port.
 *
 * Persists domain events to a JSON outbox file, ensuring eventual consistency.
 * Events are written in the same "transaction" as business data (same JSON file write).
 *
 * Outbox pattern:
 *   1. Business data + events written together (atomic at file level)
 *   2. Background process (or next request) picks up pending events
 *   3. Events marked as delivered after processing
 *
 * File format: { "events": [ { id, type, aggregateId, payload, occurredAt, delivered } ] }
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Result, InfrastructureError } from '#domain';
import { EventBus } from '../../shared_kernel/domain/ports/EventBus.js';
import { CircuitBreaker, resilientCall } from '../lib/circuit-breaker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_OUTBOX_PATH = path.resolve(__dirname, '..', 'data', 'outbox.json');

export class OutboxEventBus extends EventBus {
  #outboxPath;
  #breaker;

  constructor(outboxPath = DEFAULT_OUTBOX_PATH) {
    super();
    this.#outboxPath = outboxPath;
    this.#breaker = new CircuitBreaker({
      name: 'EventBus',
      failureThreshold: 5,
      resetTimeout: 15000,
    });
  }

  get breaker() { return this.#breaker; }

  #loadSync() {
    try {
      if (!fs.existsSync(this.#outboxPath)) return { events: [] };
      const raw = fs.readFileSync(this.#outboxPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { events: [] };
    }
  }

  async publish(event) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const data = this.#loadSync();
        const entry = {
          id: crypto.randomUUID(),
          type: event.type,
          aggregateId: event.aggregateId,
          payload: event.payload || {},
          occurredAt: (event.occurredAt || new Date()).toISOString(),
          delivered: false,
        };
        data.events.push(entry);
        const dir = path.dirname(this.#outboxPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.#outboxPath, JSON.stringify(data, null, 2), 'utf8');
        return Result.ok(entry.id);
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to publish event ${event.type}: ${error.message}`, error));
    }
  }

  async getPending() {
    try {
      return await resilientCall(this.#breaker, async () => {
        const data = this.#loadSync();
        const pending = data.events.filter(e => !e.delivered);
        return Result.ok(pending);
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to get pending events: ${error.message}`, error));
    }
  }

  async markDelivered(eventId) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const data = this.#loadSync();
        const event = data.events.find(e => e.id === eventId);
        if (event) {
          event.delivered = true;
          event.deliveredAt = new Date().toISOString();
        }
        const dir = path.dirname(this.#outboxPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.#outboxPath, JSON.stringify(data, null, 2), 'utf8');
        return Result.ok();
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to mark event ${eventId} as delivered: ${error.message}`, error));
    }
  }
}
