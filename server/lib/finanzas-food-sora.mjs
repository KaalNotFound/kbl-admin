// finanzas-food-sora.mjs — Estadísticas y datos del registro food_sora (5 slots diarios)
// (Split ADR-024)
import { query } from './finanzas-db.mjs'
import { obsidianUrl } from './obsidian-url.mjs'

// --- Food Sora ---

export function getFoodSoraStats() {
  const rows = query(`SELECT fecha, madrugada, manana, mediodia, tarde, noche FROM food_sora ORDER BY fecha`, [])
  if (!rows.length) return { total_days: 0, streak: 0, filled_slots: 0, total_slots: 0, rate: 0, calendar: [], by_slot: [] }
  const data = rows.map(r => ({ fecha: r[0], slots: { Madrugada: r[1], Mañana: r[2], Mediodía: r[3], Tarde: r[4], Noche: r[5] } }))
  const slotNames = ['Madrugada', 'Mañana', 'Mediodía', 'Tarde', 'Noche']
  let filledSlots = 0
  const bySlot = { Madrugada: { count: 0, horas: [] }, Mañana: { count: 0, horas: [] }, Mediodía: { count: 0, horas: [] }, Tarde: { count: 0, horas: [] }, Noche: { count: 0, horas: [] } }
  for (const d of data) {
    for (const s of slotNames) {
      if (d.slots[s] && d.slots[s] !== '') {
        filledSlots++
        bySlot[s].count++
        const h = d.slots[s].match(/\d{1,2}:\d{2}/)?.[0] || ''
        if (h) bySlot[s].horas.push(h)
      }
    }
  }
  let streak = 0
  for (let i = data.length - 1; i >= 0; i--) {
    const filled = slotNames.filter(s => data[i].slots[s] && data[i].slots[s] !== '').length
    if (filled > 0) streak++
    else break
  }
  const bySlotResult = slotNames.map(s => {
    const info = bySlot[s]
    const avgHora = info.horas.length > 0 ? (() => { const mins = info.horas.map(h => { const [h_, m] = h.split(':').map(Number); return h_ * 60 + m }); const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length); return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}` })() : null
    return { name: s, count: info.count, avg_hora: avgHora, pct: data.length > 0 ? Math.round((info.count / data.length) * 100) : 0 }
  })
  const calendar = data.map(d => ({ fecha: d.fecha, slots: Object.fromEntries(slotNames.map(s => [s, !!(d.slots[s] && d.slots[s] !== '')])), filled: slotNames.filter(s => d.slots[s] && d.slots[s] !== '').length }))
  return { total_days: data.length, streak, filled_slots: filledSlots, total_slots: data.length * 5, rate: data.length > 0 ? Math.round((filledSlots / (data.length * 5)) * 100) : 0, by_slot: bySlotResult, calendar }
}

export function getFoodSoraData() {
  // Data provenance (Phase 1): every daily note maps 1:1 to one food row,
  // so we expose archivo + obsidian_url on the DATA route only (stats stays aggregate).
  const rows = query(`SELECT fecha, madrugada, manana, mediodia, tarde, noche, archivo FROM food_sora ORDER BY fecha`, [])
  return rows.map(r => ({ fecha: r[0], slots: { Madrugada: r[1], Mañana: r[2], Mediodía: r[3], Tarde: r[4], Noche: r[5] }, filled_slots: [r[1], r[2], r[3], r[4], r[5]].filter(v => v && v !== '').length, total_slots: 5, archivo: r[6], obsidian_url: r[6] ? obsidianUrl(r[6]) : null }))
}
