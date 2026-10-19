// vault-pomodoro.js — Torre vault-helpers (ADR-025), sub-torre pomodoro
// Lógica de estado del Pomodoro compartida con la overlay chrono-suite
// (01 - PROYECTOS/Overlays/chrono-suite/SCRIPTS/timer-state.json).
// Migrado verbatim del router original routes/pomodoro.mjs (244L → thin).
// Sin imports de lib/ ni fs — todo el I/O por deps inyectadas (vault).
import path from 'path';

// --- Helpers puros (verbatim del router original) ---

function genTimerId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
}

function isPomodoroTimer(t) {
  return t.type === 'pomodoro' || t.label === 'Break' || t.label === 'Long Break' || t.label === 'Focus';
}

function autoAdvancePhase(state, p, currentTimerId, now) {
  const idx = state.timers.findIndex((t) => t.id === currentTimerId);
  if (idx !== -1) {
    state.timers[idx].state = 'done';
    state.timers[idx].elapsed_ms = state.timers[idx].total_ms;
  }
  if (p.phase === 'work') {
    p.completed_sessions = (p.completed_sessions || 0) + 1;
    const isLong = p.completed_sessions % (p.sessions_before_long_break || 4) === 0;
    p.phase = isLong ? 'long_break' : 'break';
    const breakMin = isLong ? (p.long_break_min || 15) : (p.break_min || 5);
    state.timers.push({
      id: genTimerId(), type: 'countdown', label: isLong ? 'Long Break' : 'Break',
      elapsed_ms: 0, total_ms: breakMin * 60000, state: 'running',
      _pausedTotal: 0, _resumedAt: now, _startAt: now,
    });
  } else {
    p.phase = 'work';
    state.timers.push({
      id: genTimerId(), type: 'pomodoro', label: 'Focus',
      elapsed_ms: 0, total_ms: (p.work_min || 25) * 60000, state: 'running',
      _pausedTotal: 0, _resumedAt: now, _startAt: now,
    });
  }
}

export function createPomodoroUseCases({ vault }) {
  const DEFAULT_STATE = { timers: [], clock_visible: true, opacity: 0.85, pomodoro: null };
  const timerStatePath = () => path.join(vault.VAULT_ROOT, '01 - PROYECTOS', 'Overlays', 'chrono-suite', 'SCRIPTS', 'timer-state.json');

  function readTimerState() {
    try {
      if (!vault.existsSync(timerStatePath())) return { ...DEFAULT_STATE };
      const raw = vault.readFile(timerStatePath());
      return raw ? JSON.parse(raw) : { ...DEFAULT_STATE };
    } catch (e) {
      console.warn('[use-case:pomodoro] readTimerState failed:', e?.message);
      return { ...DEFAULT_STATE };
    }
  }

  function writeTimerState(data) {
    vault.ensureDir(path.dirname(timerStatePath()));
    return vault.writeFile(timerStatePath(), JSON.stringify(data, null, 2));
  }

  return {
    async getStatus() {
      const state = readTimerState();
      const p = state.pomodoro;
      const now = Date.now();

      if (p) {
        if (!p._startedAt) {
          const firstTimer = state.timers.find((t) => t.type === 'pomodoro' || t.label === 'Focus' || t.label === 'Break');
          p._startedAt = firstTimer?._startAt || Date.now();
        }
        const startedAt = p._startedAt || 0;
        const maxDuration = (p.work_min + p.break_min + p.long_break_min) * 60000 * (p.sessions_before_long_break || 4) * 2;
        if (startedAt > 0 && now - startedAt > maxDuration) {
          state.pomodoro = null;
          writeTimerState(state);
        } else {
          const running = state.timers.find((t) => t.state === 'running' && isPomodoroTimer(t));
          if (running) {
            const elapsed = running.elapsed_ms + (running._resumedAt ? now - running._resumedAt : 0);
            if (elapsed >= (running.total_ms || 0)) autoAdvancePhase(state, p, running.id, now);
          }
        }
      }

      const activeTimers = state.timers.filter((t) => t.state === 'running' && isPomodoroTimer(t));
      let currentTimer = null;
      if (activeTimers.length > 0) {
        const t = activeTimers[0];
        const elapsed = t.elapsed_ms + (t._resumedAt ? now - t._resumedAt : 0);
        const remaining = Math.max(0, (t.total_ms || 0) - elapsed);
        currentTimer = {
          id: t.id, label: t.label, type: t.type, total_ms: t.total_ms,
          elapsed_ms: elapsed, remaining_ms: remaining,
          progress: t.total_ms ? ((elapsed / t.total_ms) * 100) : 0,
        };
      }

      return {
        active: !!p, paused: p ? !!p.paused : false,
        phase: p ? p.phase : null,
        work_min: p ? p.work_min : 25, break_min: p ? p.break_min : 5,
        long_break_min: p ? p.long_break_min : 15,
        sessions_before_long_break: p ? p.sessions_before_long_break : 4,
        completed_sessions: p ? (p.completed_sessions || 0) : 0,
        current_timer: currentTimer,
      };
    },

    async start(body = {}) {
      const { work_min = 25, break_min = 5 } = body;
      const state = readTimerState();
      if (state.pomodoro) return { status: 400, error: 'Pomodoro ya activo. Paralo primero.' };

      const timer = {
        id: genTimerId(), type: 'pomodoro', label: 'Focus',
        elapsed_ms: 0, total_ms: work_min * 60000, state: 'running',
        _pausedTotal: 0, _resumedAt: Date.now(), _startAt: Date.now(),
      };

      state.pomodoro = {
        active: true, paused: false, work_min, break_min,
        long_break_min: 15, sessions_before_long_break: 4,
        completed_sessions: 0, phase: 'work', _startedAt: Date.now(),
      };

      state.timers.push(timer);
      writeTimerState(state);
      return { success: true, phase: 'work', work_min, break_min };
    },

    async stop() {
      const state = readTimerState();
      if (!state.pomodoro) return { status: 400, error: 'No hay pomodoro activo' };

      for (const t of state.timers) {
        if (isPomodoroTimer(t)) { t.state = 'stopped'; t.elapsed_ms = 0; }
      }

      const completed = state.pomodoro.completed_sessions || 0;
      state.pomodoro = null;
      writeTimerState(state);
      return { success: true, completed_sessions: completed };
    },

    async skip() {
      const state = readTimerState();
      if (!state.pomodoro) return { status: 400, error: 'No hay pomodoro activo' };

      const now = Date.now();
      const p = state.pomodoro;
      const idx = state.timers.findIndex((t) => t.state === 'running' && isPomodoroTimer(t));
      if (idx === -1) return { status: 400, error: 'No hay timer activo para skipear' };

      const current = state.timers[idx];
      current.elapsed_ms = current.total_ms;
      current.state = 'done';

      if (p.phase === 'work') {
        p.completed_sessions = (p.completed_sessions || 0) + 1;
        const isLong = p.completed_sessions % (p.sessions_before_long_break || 4) === 0;
        p.phase = isLong ? 'long_break' : 'break';
        const breakMin = isLong ? (p.long_break_min || 15) : (p.break_min || 5);
        state.timers.push({
          id: genTimerId(), type: 'countdown', label: isLong ? 'Long Break' : 'Break',
          elapsed_ms: 0, total_ms: breakMin * 60000, state: 'running',
          _pausedTotal: 0, _resumedAt: now, _startAt: now,
        });
        writeTimerState(state);
        return { success: true, phase: p.phase, completed_sessions: p.completed_sessions, break_min: breakMin };
      }

      p.phase = 'work';
      state.timers.push({
        id: genTimerId(), type: 'pomodoro', label: 'Focus',
        elapsed_ms: 0, total_ms: (p.work_min || 25) * 60000, state: 'running',
        _pausedTotal: 0, _resumedAt: now, _startAt: now,
      });
      writeTimerState(state);
      return { success: true, phase: 'work', work_min: p.work_min };
    },

    async pause() {
      const state = readTimerState();
      if (!state.pomodoro) return { status: 400, error: 'No hay pomodoro activo' };
      if (state.pomodoro.paused) return { status: 400, error: 'Ya está pausado' };

      const now = Date.now();
      const runningTimers = state.timers.filter((t) => t.state === 'running' && isPomodoroTimer(t));
      if (runningTimers.length === 0) return { status: 400, error: 'No hay timer activo para pausar' };

      for (const t of runningTimers) {
        t.elapsed_ms = t.elapsed_ms + (t._resumedAt ? now - t._resumedAt : 0);
        t._pausedTotal = t.elapsed_ms;
        t.state = 'paused';
        delete t._resumedAt;
      }

      state.pomodoro.paused = true;
      writeTimerState(state);
      return { success: true };
    },

    async resume() {
      const state = readTimerState();
      if (!state.pomodoro) return { status: 400, error: 'No hay pomodoro activo' };
      if (!state.pomodoro.paused) return { status: 400, error: 'El pomodoro no está pausado' };

      const now = Date.now();
      const pausedTimers = state.timers.filter((t) => t.state === 'paused' && isPomodoroTimer(t));

      for (const t of pausedTimers) { t.state = 'running'; t._resumedAt = now; }

      state.pomodoro.paused = false;
      writeTimerState(state);
      return { success: true };
    },
  };
}
