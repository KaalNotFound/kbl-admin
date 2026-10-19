/**
 * BraveBrowserPort -- Interface for Brave browser CDP operations.
 * Implementations: BraveCdpAdapter (production), BraveMemoryAdapter (testing).
 */
export class BraveBrowserPort {
  async connect() {
    throw new Error('BraveBrowserPort.connect must be implemented');
  }

  async disconnect() {
    throw new Error('BraveBrowserPort.disconnect must be implemented');
  }

  async scanUnreadChats() {
    throw new Error('BraveBrowserPort.scanUnreadChats must be implemented');
  }

  async extractConversation(contactName) {
    throw new Error('BraveBrowserPort.extractConversation must be implemented');
  }
}
