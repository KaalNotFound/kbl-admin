/**
 * VaultFileSystemAdapter — Implements ContentStore port.
 *
 * Wraps all filesystem operations with CircuitBreaker + retry.
 * Resolves vault-relative paths to absolute paths.
 *
 * Replaces vault-helpers.mjs for all write/read/ensure operations.
 */
import fs from 'fs';
import path from 'path';
import { Result, InfrastructureError, NotFoundError } from '#domain';
import { ContentStore } from '../../shared_kernel/domain/ports/ContentStore.js';
import { CircuitBreaker, resilientCall } from '../lib/circuit-breaker.js';

export class VaultFileSystemAdapter extends ContentStore {
  #root;
  #breaker;

  /**
   * @param {string} vaultRoot - Absolute path to vault root
   */
  constructor(vaultRoot) {
    super();
    this.#root = vaultRoot;
    this.#breaker = new CircuitBreaker({
      name: 'VaultFS',
      failureThreshold: 5,
      resetTimeout: 30000,
    });
  }

  get breaker() { return this.#breaker; }

  #resolve(relativePath) {
    // Normalize and prevent path traversal
    const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
    return path.join(this.#root, normalized);
  }

  async write(relativePath, content) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const fullPath = this.#resolve(relativePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
        return Result.ok();
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to write ${relativePath}: ${error.message}`, error));
    }
  }

  async read(relativePath) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const fullPath = this.#resolve(relativePath);
        if (!fs.existsSync(fullPath)) {
          return Result.fail(new NotFoundError('File', relativePath));
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        return Result.ok(content);
      });
    } catch (error) {
      if (error instanceof NotFoundError) return Result.fail(error);
      return Result.fail(new InfrastructureError(`Failed to read ${relativePath}: ${error.message}`, error));
    }
  }

  async exists(relativePath) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const fullPath = this.#resolve(relativePath);
        return Result.ok(fs.existsSync(fullPath));
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to check existence of ${relativePath}: ${error.message}`, error));
    }
  }

  async ensureDir(dirPath) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const fullPath = this.#resolve(dirPath);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
        return Result.ok();
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to ensure dir ${dirPath}: ${error.message}`, error));
    }
  }

  async listFiles(dirPath) {
    try {
      return await resilientCall(this.#breaker, async () => {
        const fullPath = this.#resolve(dirPath);
        if (!fs.existsSync(fullPath)) return Result.ok([]);
        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        const files = entries.filter(e => e.isFile()).map(e => e.name);
        return Result.ok(files);
      });
    } catch (error) {
      return Result.fail(new InfrastructureError(`Failed to list dir ${dirPath}: ${error.message}`, error));
    }
  }
}
