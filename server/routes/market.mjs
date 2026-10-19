import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()
const MARKET_DATA_PATH = path.resolve(__dirname, '..', '_MARKET_DATA.json')

// GET /api/market/data
router.get('/market/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(MARKET_DATA_PATH, 'utf8'))
    res.json(data)
  } catch (e) {
    res.status(500).json({ trends: [], ceo_quotes: [], recommendations: [], motivational_phrases: [], last_updated: null, error: 'Error loading market data' })
  }
})

export default router
