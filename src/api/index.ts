// index.ts — barrel del cliente API por dominio (ADR-026)
// Capa de compatibilidad: los ~50 consumidores siguen importando `from '../api'`.
// Migración gradual: pasar cada consumidor a `from '../api/<dominio>'`.
// NOTA: client.ts NO se re-exporta — fetchJSON/BASE son infra interna de los módulos.

export * from './finanzas'
export * from './mastery'
export * from './active-recall'
export * from './notebooklm'
export * from './brave'
export * from './study'
export * from './behavioral'
export * from './vault'
export * from './pomodoro'
export * from './market'
export * from './whatsapp'
export * from './system'
