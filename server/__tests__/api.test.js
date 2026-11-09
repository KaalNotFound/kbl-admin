import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import { createBraveUseCases } from '../application/use-cases/brave.js'

// B2 (DIP): hoisted collector — every adapter instance built by the DI
// container is registered here so tests can assert the use-case talks to
// the port instead of global fetch.
const { braveAdapterInstances } = vi.hoisted(() => ({ braveAdapterInstances: [] }))

// Mock CDP adapter (no Brave en tests). listTabs/activateTab are the port
// methods the use-case must consume (B1+B2: DIP).
vi.mock('../infrastructure/brave-cdp-adapter.js', () => ({
BraveCdpAdapter: vi.fn().mockImplementation(function BraveCdpAdapterMock() {
  const TABS = [
    { id: 'tab1', type: 'page', title: 'Test Page', url: 'https://example.com', faviconUrl: '' },
    { id: 'tab2', type: 'page', title: 'WhatsApp', url: 'https://web.whatsapp.com', faviconUrl: '' },
  ]
  const instance = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    scanUnreadChats: vi.fn(() => Promise.resolve([
      { name: 'Test Contact', last_message: 'Hola', timestamp: new Date().toISOString(), unread: 2, avatar_letter: 'T' },
    ])),
    extractConversation: vi.fn((name) => Promise.resolve([
      { text: 'Hola!', outgoing: false, timestamp: new Date().toISOString() },
      { text: 'Como va?', outgoing: true, timestamp: new Date().toISOString() },
    ])),
    listTabs: vi.fn(() => Promise.resolve(TABS.map((t) => ({ ...t })))),
    activateTab: vi.fn(() => Promise.resolve(true)),
  }
  braveAdapterInstances.push(instance)
  return instance
})
}))

// Mock fetch — env-aware (B1: CDP_URL is env-configurable, same default).
// Note B2: after the use-case DI fix these branches only exist for any other
// module that still fetches; the brave use-case must NOT hit them.
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222'
const fetchMock = vi.fn((url) => {
  if (url === `${CDP_URL}/json`) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { id: 'tab1', type: 'page', title: 'Test Page', url: 'https://example.com', faviconUrl: '' },
        { id: 'tab2', type: 'page', title: 'WhatsApp', url: 'https://web.whatsapp.com', faviconUrl: '' },
      ]),
    })
  }
  if (url.startsWith(`${CDP_URL}/json/activate/`)) {
    return Promise.resolve({ ok: true })
  }
  return Promise.reject(new Error(`unmocked url: ${url}`))
})
vi.stubGlobal('fetch', fetchMock)

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

describe('GET /api/study/data (restored study endpoints)', () => {
  it('returns the study data shape with empty collections when the vault study dir is absent', async () => {
    const res = await request(app).get('/api/study/data')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(
      expect.objectContaining({
        notes: expect.any(Array),
        concepts: expect.any(Array),
        questions: expect.any(Array),
        doubts: expect.any(Array),
      })
    )
  })
})

describe('GET /api/study/history (restored study endpoints)', () => {
  it('returns the StudyHistoryResponse envelope (history, items, stats)', async () => {
    const res = await request(app).get('/api/study/history')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body).toHaveProperty('history')
    expect(res.body.stats).toHaveProperty('total')
  })
})

describe('POST /api/study/self-score (restored study endpoints)', () => {
  it('returns 400 when questionOrDoubt is missing', async () => {
    const res = await request(app).post('/api/study/self-score').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

// ============================================================
// B1 + B2 — env-configurable service URLs + port-injected CDP reads
// ============================================================
describe('brave use-case DIP (B1 + B2)', () => {
  it('getTabs + activateTab go through the injected port, never global fetch', async () => {
    const port = {
      listTabs: vi.fn(() => Promise.resolve([{ id: 'tabX', title: 'Port Page', url: 'https://port.test' }])),
      activateTab: vi.fn(() => Promise.resolve(true)),
    }
    const useCases = createBraveUseCases({ brave: port })
    fetchMock.mockClear()
    const tabs = await useCases.getTabs()
    const activated = await useCases.activateTab('tabX')
    expect(tabs).toEqual([{ id: 'tabX', title: 'Port Page', url: 'https://port.test' }])
    expect(activated).toEqual({ success: true })
    expect(port.listTabs).toHaveBeenCalledTimes(1)
    expect(port.activateTab).toHaveBeenCalledWith('tabX')
    // the use-case must not reach CDP HTTP endpoints directly
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('container-routed POST /brave/activate flows through the adapter port', async () => {
    const inst = braveAdapterInstances.at(-1)
    expect(inst).toBeDefined()
    inst.activateTab.mockClear()
    const res = await request(app).post('/api/brave/activate').send({ targetId: 'tab1' })
    expect(res.status).toBe(200)
    expect(inst.activateTab).toHaveBeenCalledWith('tab1')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
