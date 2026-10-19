/**
 * @interface ActiveRecallStore
 *
 * Port for persistence of active recall questions/answers.
 * Implementations: JsonActiveRecallStore, InMemoryActiveRecallStore (testing).
 */
export class ActiveRecallStore {
 /**
 * Load all due questions for review.
 * @returns {Promise<Result<Array<{id: string, question: string, answer: string, due: string}>>>}
 */
 async getDueQuestions() {
 throw new Error('ActiveRecallStore.getDueQuestions must be implemented');
 }

 /**
 * Load all questions.
 * @returns {Promise<Result<Array<{id: string, question: string, answer: string}>>>}
 */
 async getAllQuestions() {
 throw new Error('ActiveRecallStore.getAllQuestions must be implemented');
 }

 /**
 * Get a single question by ID.
 * @param {string} id
 * @returns {Promise<Result<{id: string, question: string, answer: string, due: string}|null>>}
 */
 async getQuestion(id) {
 throw new Error('ActiveRecallStore.getQuestion must be implemented');
 }

 /**
 * Submit a review score for a question (updates SRS schedule).
 * @param {string} id
 * @param {{score: number, ts: string, feedback?: string}} review
 * @returns {Promise<Result<void>>}
 */
 async submitReview(id, review) {
 throw new Error('ActiveRecallStore.submitReview must be implemented');
 }

 /**
 * Seed initial questions into the store.
 * @param {Array<{question: string, answer: string}>} questions
 * @returns {Promise<Result<void>>}
 */
 async seedQuestions(questions) {
 throw new Error('ActiveRecallStore.seedQuestions must be implemented');
 }

 /**
 * Ingest questions from external active recall export.
 * @param {Array<{question: string, answer: string, due?: string, score?: number}>} entries
 * @returns {Promise<Result<number>>} number ingested
 */
 async ingestFromExternal(entries) {
 throw new Error('ActiveRecallStore.ingestFromExternal must be implemented');
 }

 /**
 * Get aggregate statistics.
 * @returns {Promise<Result<{total: number, dueToday: number, avgScore: number}>>}
 */
 async getStats() {
 throw new Error('ActiveRecallStore.getStats must be implemented');
 }
}
