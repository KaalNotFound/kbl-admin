import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()
// Resolution order for market data (first file that exists and parses wins):
//  1. KBL_DATA_DIR/market-data.json  — personal override, untracked
//  2. server/data/market-data.json   — local runtime data, untracked
//  3. server/seed/market-data.json   — tracked curated dataset (public, citable)
const MARKET_DATA_FILENAME = 'market-data.json'
const PERSONAL_DATA_DIR = path.resolve(
  process.env.KBL_DATA_DIR || path.join(__dirname, '..', 'data'),
)
const SEED_DATA_PATH = path.join(__dirname, '..', 'seed', MARKET_DATA_FILENAME)

function loadMarketData() {
  const candidates = [
    path.join(PERSONAL_DATA_DIR, MARKET_DATA_FILENAME),
    SEED_DATA_PATH,
  ]
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue
      return JSON.parse(fs.readFileSync(candidate, 'utf8'))
    } catch {
      // Unparsable or unreadable candidate: fall through to the next source.
    }
  }
  return null
}

// GET /api/market/data
router.get('/market/data', (req, res) => {
  const data = loadMarketData()
  if (data) {
    res.json(data)
    return
  }
  res.status(404).json({ trends: [], ceo_quotes: [], recommendations: [], motivational_phrases: [], last_updated: null, error: 'No market data available' })
})

export default router
