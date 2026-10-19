# KBL_ADMIN — Fase de Planificación: Refactor de Gamificación + Integración NotebookLM

**Fecha:** 2026-07-18
**Objetivo:** Transformar el área de Estudio de KBL_ADMIN de un registro de actividad a un sistema de entrenamiento cerebral con validación de maestría real.
**Estado:** ✅ Backend + Frontend implementados. Pendiente: `npm install` (dependencias Recharts) + test de integración.

---

## Estado de Implementación (2026-07-18)

| Sprint | Archivos | Estado |
|--------|----------|--------|
| Sprint 0 — NotebookLM Proxy | `server/lib/notebooklm-proxy.mjs`, `server/routes/notebooklm.mjs` | ✅ |
| Sprint 1 — Mastery Backend | `server/lib/mastery-store.js`, `server/routes/mastery.mjs` | ✅ |
| Server Registration | `server/index.js` (2 nuevos routers) | ✅ |
| TypeScript Types | `src/types.ts` (+12 interfaces) | ✅ |
| API Client | `src/api.ts` (+12 fetch functions) | ✅ |
| Skill Tree Component | `src/components/SkillTree.tsx` | ✅ |
| Cognitive Debt Chart | `src/components/CognitiveDebt.tsx` | ✅ |
| Bias Radar | `src/components/BiasRadar.tsx` | ✅ |
| Socratic Audit | `src/components/SocraticAudit.tsx` | ✅ |
| Dashboard Integration | `src/components/StudyDashboard.tsx` (nueva sección "Cognitivo") | ✅ |
| Environment Config | `.env.example` (+NOTEBOOKLM_URL) | ✅ |
| **Pendiente** | `npm install` para Recharts (requiere permiso del operador) | ⏳ |
| **Pendiente** | `npm run build` para verificar compilación TypeScript | ⏳ |

---

## 1. Problema que Resuelve

El dashboard actual (StudyHashmap) muestra **cuándo** estudiaste, pero no **qué tan bien** entendés. Esto produce:

- **Ilusión de comprensión:** Ver "estudié 5 días seguidos" sin saber si los conceptos están consolidados.
- **Deuda cognitiva invisible:** Notas procesadas por IA sin validación humana se acumulan como "conocimiento".
- **Sin feedback loop:** No hay conexión entre "repasé en Anki" y "realmente lo entiendo".

El refactor cierra este circuito: **Nota → Validación → Scoring → Gamificación → Acción**.

---

## 2. Auditoría de Redundancias (Texto Fuente)

El plan original (generado desde NotebookLM) tenía duplicaciones. Se consolidaron 3 conceptos nucleares:

| Concepto Original | Nombres Duplicados | Consolidado A |
|---|---|---|
| Validación de comprensión | Feynman, Auditor Socrático, Stress Test, Reverse Feynman | **Validación** |
| Medición de dominio | Mastery Score, Deuda Cognitiva, Burn-down, Heatmap de Retención | **Medición** |
| Gamificación visual | Skill Tree, Grafo de Gravedad, Dopamina Real, Radar de Sesgos | **Gamificación** |

---

## 3. Estado Actual del Código

### Stack Técnico
- **Frontend:** React 18 + Vite + TailwindCSS + Recharts
- **Backend:** Express 4 + sql.js (SQLite in-memory)
- **Puerto:** 3002
- **Testing:** Vitest + Supertest

### Archivos Relevantes

```
KBL_Admin/
├── server/
│   ├── index.js                    # Entry point Express
│   ├── lib/
│   │   ├── vault-helpers.mjs       # Lee notas del vault Obsidian
│   │   └── error-handler.mjs       # Error logging
│   ├── routes/
│   │   ├── study.mjs               # Parsea notas MoureDev, conceptos, preguntas, dudas
│   │   ├── active-recall.mjs       # Store v2 de Active Recall (SQLite)
│   │   ├── anki.mjs                # Proxy a AnkiConnect (localhost:8765)
│   │   └── ...                     # Otros routes (finanzas, queue, etc.)
│   └── active-recall-store.js      # Lógica de persistencia de preguntas
├── src/
│   ├── components/
│   │   ├── StudyDashboard.tsx      # Dashboard principal de estudio (4 secciones)
│   │   ├── StudyHashmap.tsx        # Heatmap de 12 semanas (GitHub-style)
│   │   ├── AnkiDashboard.tsx       # Stats de Anki
│   │   ├── PomodoroTimer.tsx       # Timer de estudio
│   │   ├── ShadowStudy.tsx         # Estudio guiado con auto-evaluación
│   │   ├── ConceptDictionary.tsx   # Diccionario de conceptos
│   │   └── MisTutores.tsx          # Tutorías IA
│   ├── api.ts                      # Fetch wrappers para todos los endpoints
│   └── types.ts                    # Interfaces TypeScript
└── package.json                    # Dependencias
```

### Endpoints Existentes de Estudio

| Endpoint | Método | Qué hace | Limitación |
|---|---|---|---|
| `/api/study/data` | GET | Parsea TODAS las notas .md de MoureDev | Solo extrae datos, no valida comprensión |
| `/api/study/answer` | POST | Guarda respuesta de Active Recall en .md | Sin scoring persistente |
| `/api/study/self-score` | POST | Guarda auto-evaluación (correct/partial/incorrect) | Scores binarios, no graduados |
| `/api/study/feedback-request` | POST | Guarda sesión de feedback para procesamiento offline | Sin loop cerrado |
| `/api/study/history` | GET | Historial de respuestas con streak | Solo frecuencia, no profundidad |
| `/api/active-recall/*` | GET/POST | Store v2 con due dates y SM-2 | Sin conexión a concept-level |
| `/api/anki/stats` | GET | Stats de AnkiConnect | Solo actividad, no calidad |

---

## 4. Integración NotebookLM

### Respuesta: SÍ es posible

Existen librerías no-oficiales que exponen APIs REST para Google NotebookLM:

| Librería | Repo | Lenguaje | Endpoints | Auth |
|---|---|---|---|---|
| **notebooklm-mcp** ⭐ | `roomi-fields/notebooklm-mcp` | Node.js | 33 | Cookie (Playwright) |
| notebooklm-ts-api | `HenriqueCosta05/notebooklm-ts-api` | TypeScript | ~25 | Cookie (Playwright) |
| notebooklm-py | `teng-lin/notebooklm-py` | Python | 30+ | Cookie (Playwright) |
| notebooklm-api | npm registry | TypeScript | 15+ | Cookie (Playwright) |

### Opción Recomendada: `notebooklm-mcp`

**Por qué:**
- Node.js (mismo runtime que KBL_ADMIN)
- 33 endpoints documentados
- Self-hosted en `localhost:3000`
- Preguntas con citaciones a tus fuentes
- Generación de quizzes, audio, video, reports
- Multi-account rotation (anti rate-limit)
- Batch de 1000+ preguntas overnight
- OpenAPI 3.1 spec importable

**Endpoints más relevantes para KBL_ADMIN:**

| Endpoint | Uso en el Refactor |
|---|---|
| `POST /ask` | Auditor Socrático: preguntar sobre concepto + validar respuesta del operador |
| `POST /content/generate` type=quiz | Generar quizzes desde las notas del vault |
| `GET /notebooks` | Listar notebooks de estudio |
| `POST /notebooks/create` | Crear notebook por módulo del Máster |
| `POST /content/sources` | Subir notas .md como fuentes |
| `GET /notebooks/stats` | Métricas de uso de notebooks |

### Arquitectura de Integración

```
KBL_ADMIN Frontend (:3002)
       │
       ▼
KBL_ADMIN Backend (Express)
       │
       ├── /api/notebooklm/*  (nuevos routes — proxy)
       │         │
       │         ▼
       │   notebooklm-mcp (:3000)
       │         │
       │         ▼
       │   Google NotebookLM (API no-documentada)
       │
       └── /api/study/*  (routes existentes)
```

### Setup Requerido

```bash
# 1. Clonar y instalar
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
npm install && npm run build

# 2. Autenticar (una vez)
npm run setup-auth
# Abre Chrome → login con tu cuenta de Google

# 3. Iniciar en background
npm run start:http  # Puerto 3000

# 4. Verificar
curl http://localhost:3000/health
# → { "authenticated": true, "sessions": 0, "library_notebooks": 0 }
```

---

## 5. Arquitectura Propuesta

### Diagrama del Sistema

```
┌──────────────────────────────────────────────────────────────┐
│                    KBL_ADMIN FRONTEND (React)                │
├──────────────────────────────────────────────────────────────┤
│  StudyDashboard                                             │
│  ├── 📄 Notas            (existente — sin cambios)          │
│  ├── 🗺️ Mapa Actividad   (existente — StudyHashmap)        │
│  ├── 🏆 Skill Tree        (NUEVO — progresión por módulo)   │
│  ├── 📊 Deuda Cognitiva   (NUEVO — burn-down chart)         │
│  ├── 🎯 Auditor Socrático (NUEVO — validación Feynman)      │
│  ├── 🔍 Bias Radar        (NUEVO — detección de sesgos)     │
│  ├── 🗂️ Anki              (existente — sin cambios)         │
│  └── 🍅 Pomodoro          (existente — sin cambios)         │
├──────────────────────────────────────────────────────────────┤
│                    KBL_ADMIN BACKEND (Express :3002)         │
├──────────────────────────────────────────────────────────────┤
│  EXISTENTE:                    │  NUEVO:                     │
│  ├── /study/data               │  ├── /study/mastery          │
│  ├── /study/answer             │  ├── /study/debt             │
│  ├── /study/self-score         │  ├── /study/bias             │
│  ├── /study/feedback-request   │  ├── /study/socratic         │
│  ├── /study/history            │  ├── /notebooklm/* (proxy)   │
│  ├── /active-recall/*          │  │                           │
│  └── /anki/stats               │  │                           │
├──────────────────────────────────────────────────────────────┤
│  NUEVOS MÓDULOS:                                             │
│  ├── mastery-store.js    (SQLite: scores por concepto)       │
│  ├── debt-calc.mjs       (calculadora de deuda cognitiva)    │
│  ├── bias-detector.js    (algoritmo de detección de sesgos)  │
│  ├── notebooklm-proxy.js (proxy a :3000)                     │
│  └── socratic-audit.mjs  (validación Feynman via NLM)        │
├──────────────────────────────────────────────────────────────┤
│                    INFRAESTRUCTURA EXTERNA                   │
│  ├── notebooklm-mcp (:3000) — API REST NotebookLM           │
│  └── AnkiConnect (:8765) — API de Anki                      │
└──────────────────────────────────────────────────────────────┘
```

### Nuevos Endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `GET /api/study/mastery` | GET | Score por concepto (0-100). Cruza active recall + Anki + quiz history |
| `GET /api/study/mastery/:concept` | GET | Detalle de un concepto: historia de scores, última vez validado |
| `GET /api/study/debt` | GET | Deuda cognitiva: conceptos sin validar / total. Burn-down data |
| `GET /api/study/bias` | GET | Detección de sesgos: ratio IA/humano, ilusión competencia, staleness |
| `POST /api/study/socratic` | POST | Validación Feynman: envía concepto a NLM, compara con explicación del operador |
| `POST /api/notebooklm/ask` | POST | Proxy a notebooklm-mcp `/ask` |
| `POST /api/notebooklm/notebooks` | POST | Proxy: crear notebook |
| `GET /api/notebooklm/notebooks` | GET | Proxy: listar notebooks |

---

## 6. Componentes Frontend Nuevos

### 6.1 Skill Tree (`SkillTree.tsx`)

**Niveles de dominio por concepto:**

| Nivel | Nombre | Condición | Color |
|---|---|---|---|
| 0 | 🟡 Amarrado | Concepto existe en vault, sin scoring | `yellow` |
| 1 | 🟢 Expuesto | 1+ respuestas en Active Recall (cualquier score) | `green` |
| 2 | 🔵 Funcional | 3+ respuestas correctas consecutivas | `blue` |
| 3 | 🟣 Consolidado | Validación Feynman aprobada (score ≥ 85) | `purple` |
| 4 | 🔴 Maestro | Integrado en proyecto real (commit o script) | `red` |

**Visualización:** Árbol por módulo del Máster. Cada nodo = un concepto. Grosor/brillo = nivel.

### 6.2 Deuda Cognitiva (`CognitiveDebt.tsx`)

**Métrica principal:** `debt_ratio = conceptos_sin_validar / total_conceptos`

**Visualización:**
- **Burn-down chart:** Eje X = tiempo, Eje Y = deuda restante. Meta: llegar a 0.
- **Barra de progreso:** Verde = consolidados, Rojo = deuda.
- **Alerta:** Si deuda > 60% → "Necesitás una sesión de validación".

### 6.3 Auditor Socrático (`SocraticAudit.tsx`)

**Flujo:**
1. Operador selecciona un concepto.
2. Escribe una explicación en sus propias palabras (Feynman).
3. Backend envía a NLM: `"Evalúa si esta explicación de [concepto] es correcta y completa. Señala errores y lagunas."`
4. NLM responde con evaluación.
5. Frontend muestra: score (0-100), feedback, pregunta desafiante si falla.

### 6.4 Bias Radar (`BiasRadar.tsx`)

**3 ejes:**
1. **Ratio Humano/IA:** % de notas donde el operador escribió vs. la IA generó.
2. **Ilusión de Competencia:** Cuántas veces marcó "correct" en Anki pero falló el quiz.
3. **Staleness:** Conceptos que no han sido invocados en >14 días.

**Visualización:** Radar chart (Recharts ya está instalado).

---

## 7. Base de Datos: mastery-store.js

### Schema SQLite

```sql
CREATE TABLE IF NOT EXISTS concept_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept TEXT NOT NULL,
  source_note TEXT,
  source_module TEXT,
  score INTEGER NOT NULL DEFAULT 0,  -- 0-100
  score_type TEXT NOT NULL,           -- 'active_recall' | 'quiz' | 'feynman' | 'anki'
  validated_at TEXT NOT NULL,         -- ISO timestamp
  details TEXT                        -- JSON: respuesta del operador, feedback NLM, etc.
);

CREATE INDEX IF NOT EXISTS idx_concept_scores_concept ON concept_scores(concept);
CREATE INDEX IF NOT EXISTS idx_concept_scores_validated ON concept_scores(validated_at);

CREATE TABLE IF NOT EXISTS concept_levels (
  concept TEXT PRIMARY KEY,
  module TEXT,
  level INTEGER NOT NULL DEFAULT 0,  -- 0-4 (Skill Tree)
  last_validated TEXT,
  total_rep INTEGER DEFAULT 0,
  correct_rep INTEGER DEFAULT 0
);
```

### Algoritmo de Scoring

```
mastery_score(concept) = 
  ponderacion_anterior * average(historical_scores) + 
  ponderacion_reciente * latest_score +
  bonus_feynman * (1 if feynman_validated else 0) +
  bonus_streak * min(streak_count, 5) * 5

Donde:
  ponderacion_anterior = 0.3
  ponderacion_reciente = 0.5
  bonus_feynman = 15
  bonus_streak = 1 (hasta 5 puntos extra)
```

---

## 8. Sprint Plan

### Sprint 0: Setup NotebookLM (1 día)

**Objetivo:** Tener notebooklm-mcp corriendo y accesible desde KBL_ADMIN.

**Archivos:**
- `.env` — Agregar `NOTEBOOKLM_URL=http://localhost:3000`
- `server/lib/notebooklm-proxy.js` — Crear proxy genérico
- `server/routes/notebooklm.mjs` — Routes del proxy

**Pasos:**
1. Clonar `notebooklm-mcp`
2. `npm install && npm run build`
3. `npm run setup-auth` (login en Chrome)
4. `npm run start:http` (puerto 3000)
5. Verificar: `curl localhost:3000/health`
6. Crear proxy en KBL_ADMIN
7. Agregar route `/api/notebooklm/*`
8. Test: `GET /api/notebooklm/health` → debe retrasar a3000

**Criterio de aceptación:**
- [ ] `curl localhost:3002/api/notebooklm/health` retorna `{ authenticated: true }`
- [ ] `curl localhost:3002/api/notebooklm/notebooks` retorna lista vacía

---

### Sprint 1: Mastery Store (2 días)

**Objetivo:** Score por concepto basado en evidencia.

**Archivos:**
- `server/lib/mastery-store.js` — SQLite store para scores
- `server/routes/study.mjs` — Agregar endpoints `/study/mastery`
- `src/types.ts` — Agregar interfaces `ConceptScore`, `ConceptLevel`

**Endpoints nuevos:**
```
GET  /api/study/mastery           → { concepts: [{ concept, score, level, lastValidated }] }
GET  /api/study/mastery/:concept  → { concept, scores: [...], currentScore, level }
POST /api/study/mastery/validate  → { concept, score, scoreType, details }
```

**Lógica:**
- `validate`: Registra un nuevo score para un concepto. Actualiza `concept_levels`.
- `GET /mastery`: Cruza datos de `active-recall-store.js` + Anki + este store.
- Alimentación automática: cada vez que se responde una pregunta en Active Recall → `validate` automático.

**Criterio de aceptación:**
- [ ] `GET /api/study/mastery` retorna scores para conceptos existentes
- [ ] `POST /api/study/mastery/validate` persiste y recalcula
- [ ] Levels se actualizan según las reglas del Skill Tree

---

### Sprint 2: Deuda Cognitiva (1 día)

**Objetivo:** Visualizar cuánto conocimiento falta por validar.

**Archivos:**
- `server/lib/debt-calc.mjs` — Calculadora de deuda
- `server/routes/study.mjs` — Agregar endpoint `/study/debt`
- `src/components/CognitiveDebt.tsx` — Burn-down chart
- `src/api.ts` — Agregar `fetchCognitiveDebt()`

**Endpoint:**
```
GET /api/study/debt → {
  total_concepts: number,
  validated: number,
  debt_ratio: number,          // 0.0 - 1.0
  by_module: [{ module, total, validated, debt }],
  burn_down_history: [{ date, remaining }],
  alert: string | null          // "Necesitás sesión de validación" si >60%
}
```

**Criterio de aceptación:**
- [ ] Burn-down chart muestra tendencia de últimos 30 días
- [ ] Alerta visible cuando deuda > 60%
- [ ] Desglose por módulo del Máster

---

### Sprint 3: Skill Tree (1 día)

**Objetivo:** Gamificación visible con progresión por módulo.

**Archivos:**
- `src/components/SkillTree.tsx` — Árbol visual de habilidades
- `src/api.ts` — Agregar `fetchSkillTree()`

**Endpoint (usa mastery-store):**
```
GET /api/study/skill-tree → {
  modules: [{
    name: string,
    concepts: [{ concept, level, score, color }]
  }]
}
```

**Visualización:** Grid de nodos coloreados por nivel. Click en nodo → detalle + opciones de validación.

**Criterio de aceptación:**
- [ ] Cada módulo muestra sus conceptos con color por nivel
- [ ] Click en concepto muestra historial de scores
- [ ] Se ve progreso visual al pasar de nivel

---

### Sprint 4: Auditor Socrático (2 días)

**Objetivo:** Validación Feynman asistida por NotebookLM.

**Archivos:**
- `server/routes/study.mjs` — Agregar endpoint `/study/socratic`
- `src/components/SocraticAudit.tsx` — UI de validación
- `src/api.ts` — Agregar `submitSocraticAudit()`

**Endpoint:**
```
POST /api/study/socratic → {
  concept: string,
  operator_explanation: string,
  source_note?: string
}

Response → {
  score: number,           // 0-100
  feedback: string,        // Evaluación de NLM
  strengths: string[],     // Qué hizo bien
  gaps: string[],          // Qué falta
  challenge_question: string  // Pregunta desafiante si score < 85
}
```

**Prompt para NLM:**
```
Eres un tutor experto. Evalúa la siguiente explicación de un concepto técnico.

Concepto: {concept}
Explicación del estudiante: {operator_explanation}
Contexto: Nota de estudio de MoureDev Master

Evalúa:
1. Precisión (0-30): ¿La explicación es técnicamente correcta?
2. Completitud (0-30): ¿Cubre los aspectos fundamentales?
3. Simplicidad (0-20): ¿Usa lenguaje simple o depende de jerga?
4. Conexiones (0-20): ¿Relaciona con otros conceptos?

Responde en JSON: { "score": N, "feedback": "...", "strengths": [...], "gaps": [...], "challenge": "..." }
```

**Criterio de aceptación:**
- [ ] Explicación del operador se envía a NLM y se evalúa
- [ ] Score se guarda en mastery-store
- [ ] Si score < 85, se muestra pregunta desafiante
- [ ] Si score ≥ 85, el concepto sube a nivel "Consolidado"

---

### Sprint 5: Bias Radar (1 día)

**Objetivo:** Detectar sesgos cognitivos automáticamente.

**Archivos:**
- `server/lib/bias-detector.js` — Algoritmo de detección
- `server/routes/study.mjs` — Agregar endpoint `/study/bias`
- `src/components/BiasRadar.tsx` — Radar chart
- `src/api.ts` — Agregar `fetchBiasData()`

**Endpoint:**
```
GET /api/study/bias → {
  human_vs_ai_ratio: number,     // 0.0 = todo IA, 1.0 = todo humano
  illusion_of_competence: number, // % de Anki "correct" que falla en quiz
  staleness_index: number,        // % de conceptos sin invocar en 14+ días
  alerts: [{
    type: 'automation' | 'illusion' | 'staleness',
    severity: 'low' | 'medium' | 'high',
    message: string,
    concept?: string
  }]
}
```

**Lógica de detección:**
- **Ratio IA/Humano:** Analiza frontmatter de notas. Si `entity_type:: study_note` + creado por agente → IA. Si tiene `crudo::` o `pregunta::` manual → Humano.
- **Ilusión de Competencia:** Cruza Anki "easy" reviews con scores de quiz/feynman del mismo concepto. Si Anki dice "fácil" pero quiz falla → alerta.
- **Staleness:** Conceptos con `last_validated > 14 días`.

**Criterio de aceptación:**
- [ ] Radar chart muestra los 3 ejes
- [ ] Alerts se muestran como banner en el dashboard
- [ ] Click en alerta lleva al concepto afectado

---

## 9. Dependencias Nuevas (package.json)

```json
{
  "dependencies": {
    "notebooklm-mcp": "latest"
  }
}
```

> NOTA: `notebooklm-mcp` se corre como servicio separado (no se importa directamente). KBL_ADMIN se comunica vía HTTP. No se agrega como dependencia de runtime.

---

## 10. Orden de Ejecución

```
Sprint 0 (Setup NLM)     ──→  Desbloquea S4
Sprint 1 (Mastery Store) ──→  Desbloquea S2, S3, S4, S5
Sprint 3 (Skill Tree)    ──→  Gamificación visible (dopamina rápida)
Sprint 2 (Deuda Cognitiva) ─→  Métrica de progreso
Sprint 5 (Bias Radar)    ──→  Anti-illusión de competencia
Sprint 4 (Auditor Socrático) ─→  Integración completa con NLM
```

**Tiempo estimado total: ~8 días de desarrollo**

**Mínimo viable (MVP):** Sprints 0 + 1 + 3 = 4 días. Con esto ya tenés Skill Tree + Scores por concepto.

---

## 11. Decisiones Pendientes

| Decisión | Opciones | Recomendación |
|---|---|---|
| ¿Correr notebooklm-mcp como daemon o manual? | Daemon con PM2 / Script PowerShell | PowerShell (ya tenés scripts .ps1) |
| ¿Rate limits de NLM? | 50 queries/día (free) | Rotación multi-account o batch overnight |
| ¿SQLite o nuevo DB para mastery? | SQLite (mismo que active-recall) o PostgreSQL | SQLite (ya tenés sql.js) |
| ¿Refactorizar StudyHashmap existente o crear componente nuevo? | Nuevo componente, StudyHashmap queda como está | Nuevo componente |
| ¿Migrar notas antiguas al nuevo sistema? | Batch script que procese notas existentes | Sí, pero post-Sprint 1 |

---

## 12. Referencias Técnicas

- **notebooklm-mcp:** https://github.com/roomi-fields/notebooklm-mcp
- **REST API docs:** https://roomi-fields.github.io/notebooklm-mcp/notebooklm-rest-api
- **OpenAPI spec:** https://roomi-fields.github.io/notebooklm-mcp/openapi.yaml
- **Técnicas de Pablo Lomeli:** Canal YouTube / NotebookLM del operador
- **Algoritmo SM-2 (Anki):** https://supermemo.com/en/archives/sm2
- **Feynman Technique:** Explicar con palabras simples → detectar gaps
- **Active Recall:** Retrieval practice — g=0.50 según meta-análisis

---

*Este documento es la fuente de verdad para la fase de planificación. Si perdés acceso al agente, este README contiene toda la arquitectura, endpoints, schema, y criterios de aceptación necesarios para continuar.*
