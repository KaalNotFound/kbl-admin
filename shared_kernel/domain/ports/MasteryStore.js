/**
 * @interface MasteryStore
 *
 * Port for persistence of mastery/skill-tree data.
 * Implementations: JsonFileMasteryStore, InMemoryMasteryStore (testing).
 */
export class MasteryStore {
  /**
   * @param {string} conceptHash - 16-char hex hash
   * @returns {Promise<Result<{scoreHistory: Array<{score: number, ts: string}>, level: number}>>}
   */
  async load(conceptHash) {
    throw new Error('MasteryStore.load must be implemented');
  }

  /**
   * @param {string} conceptHash
   * @param {{scoreHistory: Array<{score: number, ts: string}>, level: number}} data
   * @returns {Promise<Result<void>>}
   */
  async save(conceptHash, data) {
    throw new Error('MasteryStore.save must be implemented');
  }

  /**
   * Load all mastery entries.
   * @returns {Promise<Result<Map<string, object>>>}
   */
  async loadAll() {
    throw new Error('MasteryStore.loadAll must be implemented');
  }
}
