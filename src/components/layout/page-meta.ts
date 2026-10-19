import { useAppStore } from '../../stores/app-store'
import type { Tab } from './Sidebar'
import { tabs } from './Sidebar'

const pageMeta: Record<Tab, { title: string; desc: string }> = {
  overview:     { title: 'Estado del Sistema',       desc: 'Métricas generales y salud del ecosistema KBL' },
  todos:        { title: 'TODO & Métricas',          desc: 'TODO SSOT (_PENDING.md) + métricas del vault en tiempo real + grafo' },
  context:      { title: 'Contexto de Sesión',       desc: 'Pendientes activos, roadmap y últimos checkpoints' },
  integrations: { title: 'Dashboards Conectados',    desc: 'Anki y otros sistemas integrados en KBL_Admin' },
  finanzas:     { title: 'Finanzas Personales',      desc: 'Resumen financiero, patrimonio, compras y Food Sora' },
  study:        { title: 'Panel de Estudio',          desc: 'Notas, Anki y Pomodoro integrados en un solo panel' },
  algorithms:   { title: 'Algoritmos',                desc: 'Visualizadores paso a paso para estudiar algoritmos' },
  behavioral:   { title: 'Conducta & Hábitos',       desc: 'Bloques de tiempo, rachas de estudio y adherencia al Kernel' },
  market:       { title: 'Mercado & Estrategia',     desc: 'Tendencias del mercado IA, CEOs, alineación de estudio y motivación' },
  inventory:    { title: 'Inventario de Casa',        desc: 'Gestión de alimentos y stock del hogar' },
  queue:        { title: 'Pipeline de Procesamiento', desc: 'Colas de entrada, procesamiento y errores' },
  projects:     { title: 'Proyectos Activos',          desc: 'Estado, bloqueos y actividad de proyectos' },
  entities:     { title: 'Entity Types',              desc: 'Distribución de tipos de entidad en el vault' },
  logs:         { title: 'Registros del Sistema',      desc: 'Sesiones, térmicas y logs de captura' },
  brave:        { title: 'Pestañas del Navegador',    desc: 'Mapa visual de pestañas abiertas en Brave' },
  whatsapp:     { title: 'Conversaciones WhatsApp',   desc: 'Feed de mensajes y notificaciones activas' },
}

export { pageMeta }
