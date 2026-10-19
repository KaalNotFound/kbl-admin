/**
 * @interface ContentStore
 *
 * Port for vault file system operations.
 * Implementations: VaultFileSystemAdapter, VaultMemoryAdapter (testing).
 *
 * All methods return Result<T> — never throw.
 */
export class ContentStore {
  /**
   * @param {string} relativePath - Path relative to vault root
   * @param {string} content - File content (markdown)
   * @returns {Promise<Result<void>>}
   */
  async write(relativePath, content) {
    throw new Error('ContentStore.write must be implemented');
  }

  /**
   * @param {string} relativePath
   * @returns {Promise<Result<string>>}
   */
  async read(relativePath) {
    throw new Error('ContentStore.read must be implemented');
  }

  /**
   * @param {string} relativePath
   * @returns {Promise<Result<boolean>>}
   */
  async exists(relativePath) {
    throw new Error('ContentStore.exists must be implemented');
  }

  /**
   * @param {string} dirPath
   * @returns {Promise<Result<void>>}
   */
  async ensureDir(dirPath) {
    throw new Error('ContentStore.ensureDir must be implemented');
  }

  /**
   * @param {string} dirPath
   * @returns {Promise<Result<string[]>>}
   */
  async listFiles(dirPath) {
    throw new Error('ContentStore.listFiles must be implemented');
  }
}
