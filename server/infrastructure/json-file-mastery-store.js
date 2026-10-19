/**
 * JsonFileMasteryStore — Implements MasteryStore port.
 *
 * Replaces the CJS mastery-store.js with an ESM, port-based adapter.
 * Reads/writes a single JSON file with the CircuitBreaker wrapper.
 *
 * File format: { "conceptName": { scoreHistory, level, mastery, updatedAt } }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Result, InfrastructureError } from '#domain';
import { MasteryStore } from '../../shared_kernel/domain/ports/MasteryStore.js';
import { CircuitBreaker, resilientCall } from '../lib/circuit-breaker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default store path: KBL_Admin/server/data/mastery.json
const DEFAULT_STORE_PATH = path.resolve(__dirname, '..', 'data', 'mastery.json');

export class JsonFileMasteryStore extends MasteryStore {
  #storePath;
  #breaker;

  constructor(storePath = DEFAULT_STORE_PATH) {
    super();
    this.#storePath = storePath;
    this.#breaker = new CircuitBreaker({
      name: 'MasteryStore',
      failureThreshold: 5,
      resetTimeout: 15000,
    });
  }

  get breaker() { return this.#breaker; }

  #loadAllSync() {
    try {
      if (!fs.existsSync(this.#storePath)) return {};
      const raw = fs.readFileSync(this.#storePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async load(conceptHash) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const data = this.#loadAllSync();
        const entry = data[conceptHash];
        if (!entry) return Result.ok({ scoreHistory: [], level: 0 });
        return Result.ok(entry);
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to load mastery for ${conceptHash}: ${error.message}`, error));
    }
  }

  async save(conceptHash, data) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const all = this.#loadAllSync();
        all[conceptHash] = data;
        const dir = path.dirname(this.#storePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.#storePath, JSON.stringify(all, null, 2), 'utf8');
        return Result.ok();
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to save mastery for ${conceptHash}: ${error.message}`, error));
    }
  }

  async loadAll() {
    try {
      return await resilientCall(this.#breaker, async () => {
        const data = this.#loadAllSync();
        return Result.ok(new Map(Object.entries(data)));
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to load all mastery: ${error.message}`, error));
    }
  }
}
