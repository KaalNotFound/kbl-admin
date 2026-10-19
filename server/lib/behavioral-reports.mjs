/**
 * Behavioral Reports — Statistical aggregations.
 * Extracted from behavioral-tracker.mjs for SRP compliance.
 */
import { BLOCKS, load } from './behavioral-session.mjs';

export function getDailySummary(date) {
  const data = load();
  return data[date] || { sessions: [], activities: [], summary: null };
}

export function getWeeklySummary() {
  const data = load();
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const daySummary = data[key] || { sessions: [], activities: [] };
    days.push({
      date: key,
      sessions: daySummary.sessions.length,
      activities: daySummary.activities.length,
      summary: daySummary.summary || null
    });
  }
  return days;
}

export function getBlockAdherence() {
  const data = load();
  const today = new Date().toISOString().split('T')[0];
  const dayData = data[today] || { sessions: [] };
  const blockStats = {};
  for (const block of Object.keys(BLOCKS)) {
    blockStats[block] = { planned: 1, actual: 0, percentage: 0 };
  }
  for (const session of dayData.sessions) {
    const blockName = session.block || 'DESCANSO';
    if (blockStats[blockName]) blockStats[blockName].actual++;
  }
  for (const block of Object.keys(blockStats)) {
    blockStats[block].percentage = Math.round(
      (blockStats[block].actual / blockStats[block].planned) * 100
    );
  }
  return blockStats;
}

export function getStreaks() {
  const data = load();
  const dates = Object.keys(data).sort();
  if (dates.length === 0) return { current: 0, longest: 0, total: 0 };
  let current = 0, longest = 0, total = 0, streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) streak++;
    else { longest = Math.max(longest, streak); streak = 1; }
  }
  longest = Math.max(longest, streak);
  const today = new Date().toISOString().split('T')[0];
  if (dates.includes(today)) current = streak;
  total = dates.length;
  return { current, longest, total };
}

export function getTimeline() {
  const data = load();
  const today = new Date().toISOString().split('T')[0];
  const dayData = data[today] || { sessions: [] };
  return dayData.sessions.map(s => ({
    start: s.start,
    end: s.end,
    block: s.block || 'DESCANSO',
    duration: s.end ? Math.round((new Date(s.end) - new Date(s.start)) / 60000) : null
  }));
}
