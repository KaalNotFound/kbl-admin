/**
 * Behavioral Tracker — Slim barrel re-export.
 * Core functions moved to behavioral-session.mjs and behavioral-reports.mjs.
 * This file re-exports everything for backward compatibility.
 */
export { getCurrentBlock, startSession, endSession, logActivity } from './behavioral-session.mjs';
export { getDailySummary, getWeeklySummary, getBlockAdherence, getStreaks, getTimeline } from './behavioral-reports.mjs';
