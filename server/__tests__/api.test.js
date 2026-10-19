import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

// Mock CDP helper (no Brave en tests)
vi.mock('../infrastructure/brave-cdp-adapter.js', () => ({
BraveCdpAdapter: vi.fn().mockImplementation(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  scanUnreadChats: vi.fn(() => Promise.resolve([
    { name: 'Test Contact', last_message: 'Hola', timestamp: new Date().toISOString(), unread: 2, avatar_letter: 'T' },
  ])),
  extractConversation: vi.fn((name) => Promise.resolve([
    { text: 'Hola!', outgoing: false, timestamp: new Date().toISOString() },
    { text: 'Como va?', outgoing: true, timestamp: new Date().toISOString() },
  ])),
}))
}))

// Mock fetch para Brave CDP HTTP
vi.stubGlobal('fetch', vi.fn((url) => {
  if (url === 'http://127.0.0.1:9222/json') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { id: 'tab1', type: 'page', title: 'Test Page', url: 'https://example.com', faviconUrl: '' },
        { id: 'tab2', type: 'page', title: 'WhatsApp', url: 'https://web.whatsapp.com', faviconUrl: '' },
      ]),
    })
  }
  if (url.startsWith('http://127.0.0.1:9222/json/activate/')) {
    return Promise.resolve({ ok: true })
  }
  return Promise.reject(new Error(`unmocked url: ${url}`))
}))

// Mock fs to avoid vault dependency
vi.mock('fs', () => {
  const mockFiles = {}
  const mockDirs = {}

  return {
    default: {
      readFileSync: vi.fn((p) => {
        if (mockFiles[p]) return mockFiles[p]
        throw new Error(`ENOENT: ${p}`)
      }),
      readdirSync: vi.fn((p) => mockDirs[p] || []),
      existsSync: vi.fn((p) => p in mockFiles || p in mockDirs),
      statSync: vi.fn(() => ({
        isDirectory: () => true,
        size: 100,
        mtime: new Date('2026-07-01'),
      })),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      renameSync: vi.fn(),
    },
    readFileSync: vi.fn((p) => {
      if (mockFiles[p]) return mockFiles[p]
      throw new Error(`ENOENT: ${p}`)
    }),
    readdirSync: vi.fn((p) => mockDirs[p] || []),
    existsSync: vi.fn((p) => p in mockFiles || p in mockDirs),
    statSync: vi.fn(() => ({
      isDirectory: () => true,
      size: 100,
      mtime: new Date('2026-07-01'),
    })),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
  }
})

let app

beforeAll(async () => {
  const mod = await import('../index.js')
  app = mod.app
})

describe('GET /api/overview', () => {
  it('returns health status and vault stats', async () => {
    const res = await request(app).get('/api/overview')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('health')
    expect(res.body).toHaveProperty('vault')
    expect(res.body).toHaveProperty('pipeline')
  })
})

describe('GET /api/queue', () => {
  it('returns queue stats', async () => {
    const res = await request(app).get('/api/queue')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('pending')
    expect(res.body).toHaveProperty('done')
    expect(res.body).toHaveProperty('failed')
  })
})

describe('GET /api/projects', () => {
  it('returns project list', async () => {
    const res = await request(app).get('/api/projects')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('projects')
    expect(res.body).toHaveProperty('stalled')
    expect(Array.isArray(res.body.projects)).toBe(true)
  })
})

describe('GET /api/entity-types', () => {
  it('returns entity type distribution', async () => {
    const res = await request(app).get('/api/entity-types')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('types')
    expect(res.body).toHaveProperty('total')
  })
})

describe('GET /api/logs', () => {
  it('returns system logs', async () => {
    const res = await request(app).get('/api/logs')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('sessions')
    expect(res.body).toHaveProperty('thermal')
  })
})

describe('GET /api/seen', () => {
  it('returns seen hash entries', async () => {
    const res = await request(app).get('/api/seen')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('entries')
  })
})

describe('GET /api/brave/tabs', () => {
  it('returns list of Brave tabs', async () => {
    const res = await request(app).get('/api/brave/tabs')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0]).toHaveProperty('id')
    expect(res.body[0]).toHaveProperty('title')
    expect(res.body[0]).toHaveProperty('url')
  })
})

describe('POST /api/brave/activate', () => {
  it('activates a tab by targetId', async () => {
    const res = await request(app).post('/api/brave/activate').send({ targetId: 'tab1' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
  })

  it('returns 400 if targetId missing', async () => {
    const res = await request(app).post('/api/brave/activate').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/whatsapp/chats', () => {
  it('returns WhatsApp chats with unread', async () => {
    const res = await request(app).get('/api/whatsapp/chats')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toHaveProperty('name')
    expect(res.body[0]).toHaveProperty('unread')
    expect(res.body[0]).toHaveProperty('last_message')
  })
})

describe('GET /api/whatsapp/chat/:name', () => {
  it('returns messages for a contact', async () => {
    const res = await request(app).get('/api/whatsapp/chat/Test%20Contact')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('messages')
    expect(res.body).toHaveProperty('contact', 'Test Contact')
    expect(Array.isArray(res.body.messages)).toBe(true)
    expect(res.body.messages[0]).toHaveProperty('text')
    expect(res.body.messages[0]).toHaveProperty('outgoing')
  })
})

describe('GET /api/entity-catalog', () => {
  it('returns entity catalog entries (empty if catalog missing)', async () => {
    const res = await request(app).get('/api/entity-catalog')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /api/capture', () => {
  it('saves a capture note without entity type', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({ content: 'Test note', source: 'test' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body).toHaveProperty('path')
  })

  it('saves a capture note with entity type', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({ content: 'Test classified note', source: 'test', entityType: 'lol_log' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body).toHaveProperty('path')
  })

  it('returns 400 if content is missing', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({ content: '', source: 'test' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})
