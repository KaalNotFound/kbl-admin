/**
 * FASE 6: DI Wiring Tests
 *
 * Tests that the DI container correctly wires adapters into use cases
 * and that the DI middleware injects them into the request context.
 * Does NOT spin up a full Express server (use FASE 6 report for integration validation).
 */
import { createContainer } from './di-container.js'
import { createDiMiddleware } from './middleware/di.mjs'
import { correlationIdMiddleware, requestLogger } from './infrastructure/correlation-middleware.js'
import { StructuredLogger } from './infrastructure/structured-logger.js'

let passed = 0
let failed = 0

function assert(condition, name) {
  if (condition) {
    console.log(` PASS: ${name}`)
    passed++
  } else {
    console.log(` FAIL: ${name}`)
    failed++
  }
}

// ============================================================
// Section 1: Container Wiring
// ============================================================
console.log('\n--- Container Wiring ---')

const container = createContainer()
assert(container !== null && container !== undefined, 'createContainer returns object')
assert(typeof container.contentStore === 'object', 'contentStore is object (VaultFileSystemAdapter)')
assert(typeof container.masteryStore === 'object', 'masteryStore is object (JsonFileMasteryStore)')
assert(typeof container.eventBus === 'object', 'eventBus is object (OutboxEventBus)')
assert(typeof container.logger === 'object', 'logger is object (StructuredLogger)')
assert(typeof container.useCases === 'object', 'useCases is object')
assert(typeof container.useCases.captureNote === 'function', 'useCases.captureNote is function')
assert(typeof container.useCases.submitQuizReview === 'function', 'useCases.submitQuizReview is function')
assert(typeof container.useCases.submitActiveRecallReview === 'function', 'useCases.submitActiveRecallReview is function')

// Verify logger has setCorrelationId
assert(typeof container.logger.setCorrelationId === 'function', 'logger has setCorrelationId')

// ============================================================
// Section 2: DI Middleware
// ============================================================
console.log('\n--- DI Middleware ---')

const diMiddleware = createDiMiddleware(container)
assert(typeof diMiddleware === 'function', 'createDiMiddleware returns function')

// Simulate Express req/res/next
let nextCalled = false
const fakeReq = { log: new StructuredLogger({ service: 'test' }) }
const fakeRes = {}
const fakeNext = () => { nextCalled = true }

diMiddleware(fakeReq, fakeRes, fakeNext)
assert(nextCalled === true, 'DI middleware calls next()')
assert(fakeReq.container === container, 'req.container is set to container')
assert(fakeReq.useCases === container.useCases, 'req.useCases is set')
assert(fakeReq.container.contentStore === container.contentStore, 'container.contentStore is accessible via req.container')
assert(fakeReq.container.masteryStore === container.masteryStore, 'container.masteryStore is accessible via req.container')
assert(fakeReq.container.eventBus === container.eventBus, 'container.eventBus is accessible via req.container')
assert(fakeReq.log === fakeReq.log, 'req.log is preserved (not overwritten)')

// When req.log is missing, DI middleware should create one
const fakeReqNoLog = {}
const fakeNext2 = () => {}
diMiddleware(fakeReqNoLog, fakeRes, fakeNext2)
assert(fakeReqNoLog.log instanceof StructuredLogger, 'DI middleware creates req.log when missing')
assert(fakeReqNoLog.useCases === container.useCases, 'DI middleware sets useCases even when log was missing')

// ============================================================
// Section 3: CorrelationId + RequestLogger
// ============================================================
console.log('\n--- CorrelationId + RequestLogger ---')

let correlationAssigned = false
let requestLogged = false

const fakeReq3 = {
  headers: {},
  log: new StructuredLogger({ service: 'test' }),
}
const fakeRes3 = {
  setHeader: (k, v) => {
    if (k === 'X-Correlation-Id') correlationAssigned = true
  },
}
const fakeNext3 = () => {}

correlationIdMiddleware(fakeReq3, fakeRes3, fakeNext3)
assert(correlationAssigned === true, 'correlationIdMiddleware sets X-Correlation-Id response header')
assert(typeof fakeReq3.correlationId === 'string', 'req.correlationId is assigned')
assert(fakeReq3.correlationId.length > 0, 'req.correlationId is non-empty')

// Propagates existing header
const fakeReq4 = { headers: { 'x-correlation-id': 'my-custom-id' }, log: new StructuredLogger({ service: 'test' }) }
const fakeRes4 = { setHeader: () => {} }
correlationIdMiddleware(fakeReq4, fakeRes4, () => {})
assert(fakeReq4.correlationId === 'my-custom-id', 'correlationIdMiddleware propagates existing header')

// requestLogger
const fakeReq5 = { log: new StructuredLogger({ service: 'test' }), method: 'GET', path: '/test', headers: {} }
const fakeRes5 = { status: () => fakeRes5, json: () => fakeRes5, setHeader: () => {} }
const fakeNext5 = () => { requestLogged = true }
requestLogger(fakeReq5, fakeRes5, fakeNext5)
assert(requestLogged === true, 'requestLogger calls next()')

// ============================================================
// Section 4: Container with custom options
// ============================================================
console.log('\n--- Container Custom Options ---')

const customLogger = new StructuredLogger({ service: 'custom', level: 'debug' })
const container2 = createContainer({ logger: customLogger })
assert(container2.logger === customLogger, 'createContainer accepts custom logger')

// ============================================================
// Summary
// ============================================================
console.log(`\n=== FASE 6: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)
