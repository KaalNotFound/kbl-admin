import { Router } from 'express'
import { throttledErrorLog } from '../lib/error-handler.mjs'

const router = Router()

// B1: env-configurable service URL (same default as before).
const ANKI_URL = process.env.ANKI_URL || 'http://localhost:8765'

async function ankiAction(action, params = {}) {
  const response = await fetch(ANKI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params }),
    signal: AbortSignal.timeout(5000)
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.error ? null : data.result
}

function calcStreak(history) {
  if (!Array.isArray(history) || history.length === 0) return 0
  const today = new Date()
  const dateMap = {}
  for (const [dateStr] of history) {
    dateMap[dateStr] = true
  }
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (dateMap[key]) streak++
    else break
  }
  return streak
}

// GET /api/anki/stats — proxy to AnkiConnect :8765
router.get('/anki/stats', async (req, res) => {
  try {
    const reviewed = await ankiAction('getNumCardsReviewedToday')
    const decks = await ankiAction('deckNamesAndIds')
    const history = await ankiAction('getNumCardsReviewedByDay')

    if (reviewed === null && decks === null) {
      return res.json({ reviewed: 0, due: 0, total: 0, streak: 0, connected: false, decks: [], history: [] })
    }

    const deckNames = decks ? Object.keys(decks) : []
    let totalCards = 0
    let dueCards = 0
    const deckProgress = []

    if (deckNames.length > 0) {
      const queries = deckNames.map(async (name) => {
        const total = await ankiAction('findCards', { query: `deck:"${name}"` })
        const due = await ankiAction('findCards', { query: `deck:"${name}" is:due` })
        const totalCount = Array.isArray(total) ? total.length : 0
        const dueCount = Array.isArray(due) ? due.length : 0
        return {
          name, total: totalCount, due: dueCount,
          studied: totalCount - dueCount,
          pct: totalCount > 0 ? Math.round((totalCount - dueCount) / totalCount * 1000) / 10 : 0
        }
      })
      const results = await Promise.all(queries)
      for (const d of results) {
        totalCards += d.total
        dueCards += d.due
        deckProgress.push(d)
      }
    }

    const streak = calcStreak(Array.isArray(history) ? history : [])

    res.json({
      reviewed: reviewed || 0, due: dueCards, total: totalCards, streak,
      connected: true,
      decks: deckProgress.sort((a, b) => b.pct - a.pct),
      history: Array.isArray(history) ? history : []
    })
  } catch (e) {
    // Dashboard-polling route: identical failures (Anki down) would flood the
    // console — use the shared signature-keyed throttled log. The response
    // contract (200 + connected:false shape) is preserved exactly.
    throttledErrorLog('anki', 'GET', '/api/anki/stats', e)
    res.json({ reviewed: 0, due: 0, total: 0, streak: 0, connected: false, decks: [], history: [] })
  }
})

export default router
