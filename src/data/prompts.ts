// --- PromptCard types and catalog ---
// Source: campus lessons "IA como Tutor Personalizado" + "IA en el Proceso de Aprendizaje"

export type PromptCategory =
  | 'estructura'
  | 'explicacion'
  | 'evaluacion'
  | 'practica'
  | 'descubrimiento'
  | 'rpg'

export interface PromptCard {
  id: string
  category: PromptCategory
  icon: string
  title: string
  desc: string
  template: string
  source: string
  tags: string[]
  minRows: number
}

export const CATEGORY_META: Record<PromptCategory, { label: string; icon: string; desc: string }> = {
  estructura:     { label: 'Estructura',    icon: '📐', desc: 'Arquitectura del prompt' },
  explicacion:    { label: 'Explicación',  icon: '🧅', desc: 'Simplificar y profundizar conceptos' },
  evaluacion:     { label: 'Evaluación',   icon: '🔍', desc: 'Recibir feedback sobre tu comprensión' },
  practica:       { label: 'Práctica',     icon: '⚡', desc: 'Ejercicios y aplicación activa' },
  descubrimiento: { label: 'Descubrimiento', icon: '❓', desc: 'Guiar sin dar respuestas directas' },
  rpg:            { label: 'RPG',          icon: '🎭', desc: 'Simulaciones del mundo real' },
}

export const PROMPT_CARDS: PromptCard[] = [
  // ========== ESTRUCTURA ==========
  {
    id: 'rctf',
    category: 'estructura',
    icon: '🧠',
    title: 'RCTF — Anatomía del Prompt Eficaz',
    desc: 'Todo prompt de aprendizaje necesita 4 elementos: Rol, Contexto, Tarea y Formato. Completá cada campo y la IA va a entender exactamente qué necesitás.',
    source: 'IA como Tutor Personalizado',
    tags: ['meta', 'estructura', 'universal'],
    minRows: 8,
    template: `(R) Actuá como [ROL ESPECÍFICO]
(C) Soy [TU CONTEXTO Y NIVEL]
(T) Quiero [TAREA O PROBLEMA]
(F) Respondé en [FORMATO DESEADO]

--- Ejemplo ---
(R) Actuá como un tutor socrático de lógica
(C) Estoy aprendiendo sobre bucles en programación
(T) Ayudame a entender cuándo usar for vs while con ejemplos prácticos
(F) Explicame con pseudocódigo y preguntas orientadoras`,
  },

  // ========== EXPLICACION ==========
  {
    id: 'eli5',
    category: 'explicacion',
    icon: '👶',
    title: 'ELI5 — Simplificación Progresiva',
    desc: 'Empezá con una explicación simple y agregá capas de complejidad progresivamente. Ideal cuando un concepto no termina de cerrar.',
    source: 'IA como Tutor Personalizado',
    tags: ['simplificacion', 'progresivo', 'principiante'],
    minRows: 5,
    template: `(R) Actuá como un experto que sabe simplificar sin perder precisión
(C) Soy un principiante absoluto en [TEMA]
(T) Explicame [CONCEPTO] como si tuviera 5 años. Después de la explicación simple, agregá capas de complejidad: primero la intuición, luego detalles técnicos, y finalmente el funcionamiento interno
(F) Empezá con la versión más simple y aumentá complejidad en párrafos separados`,
  },

  {
    id: 'cebolla',
    category: 'explicacion',
    icon: '🧅',
    title: 'Técnica de la Cebolla — Capas de Profundidad',
    desc: 'Pedí el mismo concepto en múltiples niveles de abstracción. Ideal para pasar de intuición a dominio técnico sin saltos.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['profundizacion', 'capas', 'niveles'],
    minRows: 6,
    template: `(R) Actuá como un tutor que domina la técnica de profundización progresiva
(C) Soy un estudiante que quiere entender [CONCEPTO] desde cero
(T) Explicame [CONCEPTO] por capas:
  — Nivel 1: como si tuviera 5 años
  — Nivel 2: para un estudiante de tecnología (introduciendo términos como "entrada" y "salida")
  — Nivel 3: con terminología técnica y matemática
  — Nivel 4: con ejemplos de implementación real
(F) Dame cada nivel por separado. Esperá mi señal "siguiente nivel" antes de continuar`,
  },

  {
    id: 'analogias',
    category: 'explicacion',
    icon: '🌉',
    title: 'Analogías como Puente',
    desc: 'Usá tu experiencia previa como base para entender conceptos nuevos. La IA traduce términos técnicos a tu campo profesional.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['analogia', 'experiencia-previa', 'traduccion'],
    minRows: 6,
    template: `(R) Actuá como un traductor de conceptos técnicos a experiencias profesionales
(C) Soy un ex-profesional de [PROFESIÓN/CAMPO ANTERIOR]
(T) Explicame [CONCEPTO] usando analogías detalladas de [MI CAMPO PROFESIONAL]. Cada analogía debe mapear componentes del concepto a elementos concretos de mi campo
(F) Para cada analogía: concepto técnico → elemento análogo → explicación del mapeo → definición técnica formal`,
  },

  // ========== EVALUACION ==========
  {
    id: 'feynman',
    category: 'evaluacion',
    icon: '📝',
    title: 'Feynman Asistida — Evaluación',
    desc: 'Explicá un concepto en tus palabras. La IA evalúa si es correcto, qué partes son confusas y qué falta. No da la respuesta — guía.',
    source: 'IA como Tutor Personalizado',
    tags: ['explicacion', 'evaluacion', 'auto-diagnostico'],
    minRows: 7,
    template: `(R) Actuá como un tutor crítico especializado en el método Feynman
(C) Voy a explicarte [CONCEPTO] con mis propias palabras
(T) Analizá mi explicación. Decime: ¿es conceptualmente correcta? ¿qué partes son confusas? ¿qué me falta?
(F) Feedback estructurado en 3 secciones: exactitud → claridad → brechas. No me des la explicación correcta — señalá qué revisar

--- Mi explicación ---
[INSERTÁ TU EXPLICACIÓN ACÁ]`,
  },

  {
    id: 'rubber-duck',
    category: 'evaluacion',
    icon: '🐤',
    title: 'Patito de Goma 2.0 — Validación Lógica',
    desc: 'Explicá tu plan paso a paso. La IA identifica fallos lógicos y edge cases sin resolver el problema por vos.',
    source: 'IA como Tutor Personalizado',
    tags: ['plan', 'logica', 'debug', 'validacion'],
    minRows: 7,
    template: `(R) Actuá como un revisor crítico de planes y arquitectura lógica
(C) Voy a presentarte mi enfoque para [PROBLEMA]
(T) Identificá fallos lógicos, ineficiencias o casos límite (edge cases) que no consideré. No me des la solución
(F) Listá los problemas encontrados sin resolverlos. Cada uno: ubicación → descripción del riesgo

--- Mi plan paso a paso ---
[EXPLICÁ TU PLAN ACÁ]`,
  },

  {
    id: 'analisis-logica',
    category: 'evaluacion',
    icon: '🔬',
    title: 'Análisis de Lógica — Code Review',
    desc: 'Pasale tu código o pseudocódigo a la IA para que identifique fallos, ineficiencias y casos límite antes de ejecutarlo.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['codigo', 'review', 'logica', 'debug'],
    minRows: 7,
    template: `(R) Actuá como un code reviewer senior exigente
(C) Estoy aprendiendo [TEMA] y escribí este código/pseudocódigo
(T) Revisá el siguiente código. Identificá: fallos lógicos, ineficiencias, casos límite (edge cases) no considerados, malas prácticas
(F) Listá cada problema con: ubicación en el código → descripción → por qué es problemático. No escribas la versión corregida

--- Código ---
[PEGÁ TU CÓDIGO O PSEUDOCÓDIGO ACÁ]`,
  },

  {
    id: 'limites-contraejemplos',
    category: 'evaluacion',
    icon: '🚧',
    title: 'Límites y Contraejemplos',
    desc: 'Probá qué tan bien entendés un concepto pidiendo casos que lo parecen pero no lo son. La frontera es donde está el aprendizaje real.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['limites', 'contraejemplos', 'precision', 'fronteras'],
    minRows: 6,
    template: `(R) Actuá como un crítico riguroso que prueba los límites de las definiciones técnicas
(C) He estado estudiando [CONCEPTO] y creo entenderlo
(T) Dame 3 ejemplos de cosas que PARECEN [CONCEPTO] pero NO lo son según la definición técnica. Explicá por qué cada caso no encaja y qué límite de la definición estamos probando
(F) 3 casos. Cada uno: ejemplo → por qué parece [CONCEPTO] → por qué NO es [CONCEPTO] → qué aprendemos sobre la frontera del concepto`,
  },

  // ========== PRACTICA ==========
  {
    id: 'active-recall',
    category: 'practica',
    icon: '🔁',
    title: 'Active Recall / Quizmaster',
    desc: 'Después de estudiar un tema, la IA te genera preguntas una por una con feedback. No leas — recordá activamente.',
    source: 'IA como Tutor Personalizado / IA en el Proceso de Aprendizaje',
    tags: ['recall', 'preguntas', 'cuestionario', 'feedback'],
    minRows: 5,
    template: `(R) Actuá como un Quizmaster interactivo especializado en [TEMA]
(C) He estado estudiando [TEMA] y quiero evaluar mi retención
(T) Haceme [5] preguntas sobre [TEMA] para evaluar mi comprensión. Cubrí: definiciones, relaciones entre conceptos, casos prácticos y trampas comunes
(F) Una pregunta por vez. Esperá mi respuesta, dame feedback detallado, y solo entonces pasá a la siguiente`,
  },

  {
    id: 'generador-ejercicios',
    category: 'practica',
    icon: '🏗️',
    title: 'Generador de Ejercicios — Scaffolding',
    desc: 'Ejercicios progresivos con andamiaje: arrancá fácil, aumentá dificultad. La IA no revela la solución hasta que respondas.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['ejercicios', 'scaffolding', 'progresivo', 'practica'],
    minRows: 7,
    template: `(R) Actuá como un instructor de [TEMA] que usa la técnica de scaffolding (andamiaje)
(C) Estoy aprendiendo [CONCEPTO] y necesito practicar con ejercicios
(T) Generame 5 ejercicios prácticos sobre [CONCEPTO]. Empezá muy fácil y aumentá la dificultad progresivamente. Cada ejercicio debe construir sobre el anterior
(F) Presentá los ejercicios UNO POR UNO. No reveles la solución hasta que yo proporcione mi respuesta y pida la corrección`,
  },

  {
    id: 'simulador-bugs',
    category: 'practica',
    icon: '🐛',
    title: 'Simulador de Bugs',
    desc: 'La IA escribe código con un error deliberado. Tu tarea: encontrarlo. Entrenamiento activo de debugging.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['debug', 'bugs', 'errores', 'caza'],
    minRows: 7,
    template: `(R) Actuá como un instructor que usa errores como herramienta de aprendizaje
(C) Estoy practicando [CONCEPTO/TEMA] y quiero ejercitar mi ojo clínico para bugs
(T) Creá un bloque de código simple que intente [ACCIÓN]. Introducí deliberadamente UN error lógico común de principiante (bucle infinito, off-by-one, etc.)
(F) Mostrame el código con el bug. No me digas cuál es. Esperá mi diagnóstico. Solo después confirmá si es correcto y explicá la solución`,
  },

  // ========== DESCUBRIMIENTO ==========
  {
    id: 'socratic',
    category: 'descubrimiento',
    icon: '❓',
    title: 'Método Sacrático — Descubrimiento Guiado',
    desc: 'No te da la solución. Hace preguntas orientadoras para que descubras la lógica por vos mismo. Una pregunta a la vez.',
    source: 'IA como Tutor Personalizado',
    tags: ['socratico', 'descubrimiento', 'preguntas', 'guiado'],
    minRows: 5,
    template: `(R) Actuá como un tutor socrático estricto. REGLA CRÍTICA: Nunca des respuestas directas, código o soluciones completas. Respondé siempre con una pregunta orientadora
(C) Quiero resolver [PROBLEMA] y necesito descubrir la lógica por mí mismo
(T) Ayudame a resolver este problema. No me des la solución. Haceme preguntas orientadoras, una por una
(F) Una pregunta por vez. Esperá mi respuesta antes de continuar. Si voy por mal camino, guiame con otra pregunta`,
  },

  {
    id: 'no-solution',
    category: 'descubrimiento',
    icon: '🙈',
    title: 'Pista Sutil — No me des la respuesta',
    desc: 'Cuando estás atascado. La IA no da la solución — da una pista sutil para que reconsideres tu enfoque.',
    source: 'IA como Tutor Personalizado',
    tags: ['pista', 'atascado', 'sutil', 'ayuda-minima'],
    minRows: 7,
    template: `(R) Actuá como un tutor que da pistas mínimas sin revelar soluciones
(C) Estoy atascado en [PROBLEMA]. Ya intenté [ENFOQUE ACTUAL]
(T) No me des la solución completa. Dame UNA pista sutil para reconsiderar mi enfoque. Solo una
(F) Pista breve, máxima 2 líneas, sin código. Si no es suficiente, puedo pedir otra pista

--- Mi enfoque actual ---
[EXPLICÁ TU LÓGICA Y DÓNDE ESTÁS TRABADO ACÁ]`,
  },

  // ========== RPG ==========
  {
    id: 'entrevista-tecnica',
    category: 'rpg',
    icon: '🎙️',
    title: 'Simulación de Entrevista Técnica',
    desc: 'La IA actúa como entrevistador senior. Preguntas de fundamentos y lógica, sin código específico. Evaluación al final.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['entrevista', 'rpg', 'trabajo', 'senior'],
    minRows: 6,
    template: `(R) Actuá como un entrevistador técnico senior evaluando para un puesto junior
(C) Estoy preparando una entrevista técnica real para un puesto de [PUESTO]
(T) Simulemos una entrevista técnica. Centrate en preguntas sobre fundamentos de software y resolución de problemas lógicos (sin código específico). Empezá con una pregunta y esperá mi respuesta
(F) Procedé pregunta por pregunta como en una entrevista real. Evaluá mis respuestas al final sin interrumpir durante las preguntas`,
  },

  {
    id: 'stakeholders',
    category: 'rpg',
    icon: '💼',
    title: 'Stakeholders No Técnicos',
    desc: 'Simulá una reunión con un CEO sin experiencia técnica. Tenés que explicar conceptos complejos en lenguaje de negocio.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['stakeholders', 'rpg', 'comunicacion', 'ceo'],
    minRows: 7,
    template: `(R) Actuá como un CEO sin experiencia técnica que cuestiona decisiones desde la perspectiva del negocio
(C) Soy un desarrollador que necesita explicar [CONCEPTO TÉCNICO] a stakeholders no técnicos
(T) Simulemos una reunión. Tengo que explicarte [CONCEPTO] y por qué necesitamos [ACCIÓN/RECURSO]. Hacé preguntas de negocio, no técnicas. Cuestioná mis términos
(F) Respondé en carácter de CEO. Si uso jerga técnica, interrumpime y pedime que lo explique en lenguaje de negocio. Evaluá mis respuestas al final`,
  },

  {
    id: 'debate',
    category: 'rpg',
    icon: '⚔️',
    title: 'Debate Conceptual',
    desc: 'La IA toma una postura opuesta a la tuya. Descubrí los matices de un tema discutiendo ambos lados.',
    source: 'IA en el Proceso de Aprendizaje',
    tags: ['debate', 'rpg', 'pensamiento-critico', 'argumentacion'],
    minRows: 7,
    template: `(R) Actuá como un contrincante de debate con una postura definida y argumentos sólidos
(C) Soy un estudiante que quiere explorar ambos lados de [TEMA]
(T) Vamos a debatir: "[TEMA]". Tu postura es [POSTURA A]. Mi postura es [POSTURA B]. Empezá con tu primer argumento sólido
(F) Turno por turno: un argumento a la vez. Esperá mi contraargumento antes de continuar. No resumas ni concluyas al final — solo debatí

--- Ejemplo ---
TEMA: "¿Es siempre mejor la solución más eficiente?"
POSTURA A: "La eficiencia es el factor más importante, incluso por encima de la legibilidad"
POSTURA B: "La claridad y mantenibilidad son más importantes que la eficiencia pura"`,
  },

  // ========== NotebookLM Harvest (Síntesis de Documentación) ==========
  {
    id: 'guia-estudio-notebooklm',
    category: 'estructura',
    icon: '📚',
    title: 'Guía de Estudio Estructurada (NotebookLM)',
    desc: 'Generá una guía de estudio organizada a partir de múltiples fuentes. Ideal para sintetizar documentación técnica dispersa en un recurso cohesivo.',
    source: 'Síntesis de Documentación con NotebookLM',
    tags: ['guia', 'estudio', 'sintesis', 'notebooklm', 'estructura'],
    minRows: 7,
    template: `(R) Actuá como un asistente de investigación especializado en sintetizar documentación técnica
(C) Tengo [N] fuentes sobre [TEMA] y necesito organizar el estudio
(T) Basándote en todas las fuentes, creá una guía de estudio estructurada sobre [TEMA]. Incluí secciones sobre [ASPECTOS CLAVE]. Cada sección debe tener: definiciones, relaciones entre conceptos y preguntas de repaso
(F) Guía estructurada con secciones claras, viñetas para conceptos clave, y preguntas de active recall al final de cada sección

--- Ejemplo ---
(R) Actuá como un asistente de investigación
(C) Tengo documentación técnica sobre React Server Components y 3 artículos de referencia
(T) Creá una guía de estudio estructurada sobre RSC. Incluí: qué son, cómo se diferencian de CSR/SSR, cuándo usarlos
(F) Guía con secciones, definiciones, comparativas y preguntas de repaso`,
  },

  {
    id: 'flashcards-fuentes',
    category: 'practica',
    icon: '🃏',
    title: 'Generador de Flashcards desde Fuentes',
    desc: 'Transformá documentación en flashcards para repaso espaciado. La IA extrae términos clave y genera pares pregunta-respuesta desde tus fuentes.',
    source: 'Síntesis de Documentación con NotebookLM',
    tags: ['flashcards', 'active-recall', 'notebooklm', 'repaso', 'fuentes'],
    minRows: 7,
    template: `(R) Actuá como un generador de material de estudio que transforma documentación en flashcards
(C) Tengo fuentes sobre [TEMA] y quiero crear material de repaso espaciado
(T) Generá [N] flashcards (pregunta + respuesta) sobre los términos y conceptos clave definidos en las fuentes. Cubrí: definiciones, relaciones, casos de uso y distinciones importantes
(F) Lista de flashcards numeradas. Cada una: pregunta → respuesta breve. Agrupá por categoría temática

--- Ejemplo ---
(R) Actuá como un generador de flashcards
(C) Tengo documentación oficial sobre Docker y un tutorial de contenedores
(T) Generá 10 flashcards sobre conceptos clave de Docker (contenedores, imágenes, volúmenes, redes)
(F) Flashcards numeradas por categoría: pregunta → respuesta`,
  },

  {
    id: 'comparativa-tecnologias',
    category: 'estructura',
    icon: '📊',
    title: 'Tabla Comparativa de Tecnologías',
    desc: 'Compará dos tecnologías usando documentación oficial como fuente de verdad. La IA genera una tabla estructurada sin opiniones de terceros.',
    source: 'Síntesis de Documentación con NotebookLM',
    tags: ['comparativa', 'tecnologias', 'documentacion', 'notebooklm', 'decision'],
    minRows: 8,
    template: `(R) Actuá como un analista técnico especializado en comparativas de tecnologías
(C) Estoy evaluando [Tec A] vs [Tec B] para [PROYECTO/CONTEXTO]
(T) Basándote en la documentación oficial de [Tec A] y [Tec B], creá una tabla comparativa estructurada por [CRITERIOS]. Cada criterio debe tener: definición, valor para A, valor para B, y recomendación según contexto
(F) Tabla markdown con filas de criterios y columnas comparativas. Incluí fila de recomendación final según perfiles de uso

--- Ejemplo ---
(R) Actuá como un analista técnico
(C) Estoy evaluando Express vs Fastify para una API REST con TypeScript
(T) Compará Express y Fastify usando: rendimiento, ecosistema, facilidad de uso, soporte TypeScript, middlewares
(F) Tabla markdown con criterios, valores y recomendación`,
  },

  // ========== Uso Responsable Harvest (Uso Responsable durante el Aprendizaje) ==========
  {
    id: 'validador-comprension',
    category: 'evaluacion',
    icon: '🧪',
    title: 'Validador Crítico — Anti-Ilusión de Competencia',
    desc: 'La IA te hace preguntas para verificar si REALMENTE entendiste o solo creés que entendiste. No acepta tu comprensión al pie de la letra.',
    source: 'Uso Responsable durante el Aprendizaje',
    tags: ['validacion', 'comprension', 'ilusion-competencia', 'autoevaluacion', 'critical-thinking'],
    minRows: 7,
    template: `(R) Actuá como un validador crítico que expone la ilusión de competencia
(C) Acabo de leer/recibir una explicación sobre [TEMA] y creo haberlo entendido
(T) Haceme preguntas que DEMUESTREN si realmente entendí o solo creo que entendí. Cubrí: definiciones precisas, relaciones con otros conceptos, casos límite y aplicación práctica. Si mi respuesta es superficial, decímelo. No aceptes mi comprensión al pie de la letra
(F) Una pregunta por vez. Esperá mi respuesta. Si es superficial, señalalo y reformulá la pregunta. No reveles respuestas correctas hasta que haya agotado mi intento`,
  },

  {
    id: 'regla-20-minutos',
    category: 'descubrimiento',
    icon: '⏳',
    title: 'Regla de los 20 Minutos — Autonomía Cognitiva',
    desc: 'Antes de recibir ayuda de la IA, verificá que hayas intentado resolverlo solo al menos 20 minutos. Protege tu capacidad de construir mapas mentales.',
    source: 'Uso Responsable durante el Aprendizaje',
    tags: ['autonomia', '20-minutos', 'lucha-productiva', 'proteccion', 'esfuerzo'],
    minRows: 7,
    template: `(R) Actuá como un guardián de mi autonomía cognitiva. REGLA: No des respuestas directas hasta que verifiques mi esfuerzo previo
(C) Estoy frente a [PROBLEMA] y tentado a pedir ayuda directa
(T) Antes de darme cualquier respuesta, verificá: ¿Intenté resolverlo solo por al menos 20 minutos? Si no — decime "Volvé en 20 minutos". Si sí — ayudame pero sin darme la solución completa, guiame con pistas
(F) Si no pasaron 20 min: respuesta única "Volvé en 20 minutos". Si pasaron: una pista sutil, no la solución`,
  },

  {
    id: 'bucle-verificacion',
    category: 'evaluacion',
    icon: '🔁',
    title: 'Bucle de Verificación — Workflow Crítico',
    desc: 'Pasale a la IA su propia respuesta para que la valide críticamente. Detecta alucinaciones, supuestos no verificados y edge cases antes de usarla.',
    source: 'Uso Responsable durante el Aprendizaje',
    tags: ['verificacion', 'workflow', 'critico', 'autocritica', 'validacion', 'alucinaciones'],
    minRows: 8,
    template: `(R) Actuá como un revisor crítico post-generación especializado en detectar alucinaciones y errores sutiles
(C) Te voy a pasar la respuesta que generaste para [PROBLEMA/CONTEXTO]
(T) Validá críticamente tu propia respuesta. Identificá: posibles alucinaciones, supuestos no verificados, edge cases no considerados, y código/razonamiento sutilmente incorrecto. No me des la respuesta otra vez — dame tu autocrítica estructurada
(F) Respondé en 4 secciones: (1) Alucinaciones detectadas (2) Supuestos cuestionables (3) Edge cases omitidos (4) Nivel de confianza en tu propia respuesta. Sin regresar la solución original`,
  },

  // ========== Herramientas Especializadas por Fase (Campus Harvest 2026-07-04) ==========
  {
    id: 'refactorizacion-global',
    category: 'practica',
    icon: '🔧',
    title: 'Refactorización Asistida con Visión Global',
    desc: 'Antes de refactorizar, la IA indexa el proyecto completo, identifica dependencias ocultas y propone un plan con análisis de riesgos. Ideal para refactorizaciones que tocan múltiples archivos.',
    source: 'Herramientas Especializadas por Fase (MoureDev)',
    tags: ['refactorizacion', 'vision-global', 'cursor', 'project-awareness', 'plan'],
    minRows: 8,
    template: `(R) Actuá como un arquitecto de refactorización con visión global del proyecto
(C) Tengo un proyecto [TIPO] con archivos interconectados. Necesito refactorizar [MÓDULO]
(T) 1) Indexá los archivos relevantes. 2) Identificá dependencias ocultas y efectos secundarios. 3) Proponé plan de refactorización antes de tocar código. 4) Implementá asegurando que el comportamiento externo no cambie
(F) Plan → Análisis de riesgos → Implementación → Verificación

--- Ejemplo ---
(R) Actuá como arquitecto de refactorización
(C) Tengo un dashboard React con 3 componentes con lógica de fetching duplicada
(T) Identificá el patrón duplicado, proponé un custom hook unificado, implementá sin cambiar la UI
(F) Archivos afectados → Plan → Código → Verificación de que nada cambió visualmente`,
  },

  {
    id: 'coderabbit-local',
    category: 'evaluacion',
    icon: '🐇',
    title: 'CodeRabbit Local — Autocrítica Post-Generación',
    desc: 'Después de generar código, la IA se autoevalúa como revisor externo: seguridad, rendimiento, edge cases y deuda técnica. Score del 1 al 10.',
    source: 'Herramientas Especializadas por Fase (MoureDev)',
    tags: ['code-review', 'autoevaluacion', 'seguridad', 'calidad', 'codigo'],
    minRows: 8,
    template: `(R) Actuá como CodeRabbit — revisor de código automático
(C) Acabo de generar [CÓDIGO/TAREA] como asistente de IA
(T) Revisá el código que escribiste como revisor externo. Identificá: 1) Fallos de seguridad, 2) Problemas de rendimiento, 3) Malas prácticas, 4) Edge cases no cubiertos, 5) Deuda técnica introducida
(F) Lista numerada de issues con severidad (CRITICAL / MAJOR / MINOR) + sugerencia de fix + score final (1-10)

--- Ejemplo ---
(R) Actuá como CodeRabbit
(C) Acabo de generar un endpoint POST /api/users con validación y persistencia
(T) Revisá el código. Buscá: SQL injection, validación de input, errores de tipo, manejo de excepciones
(F) Issues con severidad + score final`,
  },

  {
    id: 'documentacion-automatica',
    category: 'estructura',
    icon: '📄',
    title: 'Documentación Automática de Componentes',
    desc: 'La IA analiza un componente o módulo y genera documentación técnica completa: propósito, props, ejemplo de uso y edge cases.',
    source: 'Herramientas Especializadas por Fase (MoureDev)',
    tags: ['documentacion', 'docstrings', 'componentes', 'mantenimiento', 'automatico'],
    minRows: 7,
    template: `(R) Actuá como un documentador técnico automático
(C) Necesito documentar [COMPONENTE/MÓDULO] de mi proyecto
(T) Analizá el componente y generá: 1) Propósito, 2) Props/parámetros con tipos, 3) Ejemplo de uso, 4) Edge cases conocidos
(F) Formato docstring estándar con secciones separadas. Primero análisis, después docstring formateado

--- Ejemplo ---
(R) Actuá como documentador técnico
(C) Necesito documentar un componente Button con variantes (primary, secondary, danger) y estado loading
(T) Generá un docstring JSDoc completo
(F) Descripción → @param → @returns → @example → @see`,
  },

  // ========== Uso Responsable durante el Desarrollo (Campus Harvest 2026-07-04) ==========
  {
    id: 'metodo-sandwich',
    category: 'practica',
    icon: '🥪',
    title: 'Método del Sandwich — Ciclo Híbrido',
    desc: 'Humano diseña → IA genera → Humano verifica e integra. Mantené el control de la arquitectura mientras delegás implementación con supervisión.',
    source: 'Uso Responsable durante el Desarrollo (MoureDev)',
    tags: ['hibrido', 'sandwich', 'diseno', 'verificacion', 'implementacion'],
    minRows: 9,
    template: `(R) Actuá como un implementador bajo el método del Sandwich
(C) Voy a diseñar la solución. Vos generás el código. Yo verifico e integro
(T) Fase 1: Yo te explico la arquitectura y lógica que diseñé. Fase 2: Generá el código siguiendo exactamente mi diseño. Fase 3: Señalame 3 cosas que debería verificar antes de integrar
(F) Iterativo: mi diseño → tu código → tu autocrítica → mi verificación → iteración

--- Ejemplo ---
(R) Actuá como implementador Sandwich
(C) Te explico el diseño de un custom hook useAuth que necesita validar tokens y refrescar sesión
(T) Fase 1: escuchá mi diseño. Fase 2: implementá. Fase 3: decime qué edge cases no cubrí en mi diseño
(F) Diseño → Código → Autocrítica`,
  },

  {
    id: 'debug-fuentes-externas',
    category: 'descubrimiento',
    icon: '🔍',
    title: 'Regla de Depuración — Debug con Fuentes Externas',
    desc: 'La IA busca en documentación oficial, GitHub Issues y Stack Overflow antes de proponer solución. Corta el bucle de depender solo del conocimiento interno del modelo.',
    source: 'Uso Responsable durante el Desarrollo (MoureDev)',
    tags: ['debug', 'fuentes-externas', 'github-issues', 'stackoverflow', 'validacion-externa'],
    minRows: 7,
    template: `(R) Actuá como un debugger que solo usa fuentes externas verificables
(C) Tengo un error en [CÓDIGO/CONTEXTO] que no puedo resolver
(T) No uses tu conocimiento interno. Buscá en: 1) Documentación oficial de [TECNOLOGÍA], 2) GitHub Issues del proyecto, 3) Stack Overflow. Mostrame las fuentes exactas antes de proponer solución
(F) Fuente encontrada → Cita textual → Por qué aplica a mi caso → Solución propuesta

--- Ejemplo ---
(R) Actuá como debugger con fuentes externas
(C) Mi app React da error "Invalid hook call" al renderizar un componente
(T) Buscá en docs oficiales de React y GitHub Issues. No uses tu conocimiento previo
(F) Fuente → Cita → Relación con mi error → Fix`,
  },

  {
    id: 'practica-deliberada',
    category: 'practica',
    icon: '✍️',
    title: 'Práctica Deliberada — Code Review Kinestésico',
    desc: 'Escribí código a mano para afinar fundamentos. La IA compara tu versión con la óptima y señala diferencias en estructura, lógica y buenas prácticas.',
    source: 'Uso Responsable durante el Desarrollo (MoureDev)',
    tags: ['practica', 'codigo-manual', 'kinestesico', 'comparacion', 'fundamentos'],
    minRows: 7,
    template: `(R) Actuá como un coach de práctica deliberada
(C) Quiero escribir código a mano para afinar fundamentos
(T) Dame un fragmento de [TEMA] para que lo escriba manualmente. Después de que lo escriba, comparalo con tu versión y señalá diferencias. Enfocate en: estructura, lógica, buenas prácticas
(F) Ejercicio → Mi escritura → Tu comparación → Explicación de diferencias

--- Ejemplo ---
(R) Actuá como coach de práctica deliberada
(C) Quiero practicar Express middleware
(T) Dame un middleware de autenticación simple para escribir a mano. Después compará
(F) Código a copiar → mi versión → diferencias señaladas`,
  },

  {
    id: 'anti-plausibilidad',
    category: 'evaluacion',
    icon: '🎯',
    title: 'Validación de Output — Anti-Plausibilidad',
    desc: 'No te conformes con que "suene bien". La IA verifica corrección lógica, edge cases, seguridad y eficiencia de su propia respuesta.',
    source: 'Uso Responsable durante el Desarrollo (MoureDev)',
    tags: ['validacion', 'veracidad', 'plausibilidad', 'seguridad', 'edge-cases', 'eficiencia'],
    minRows: 9,
    template: `(R) Actuá como un validador de veracidad, no de plausibilidad
(C) Generaste [CÓDIGO/SOLUCIÓN] para [PROBLEMA]
(T) No me digas si "suena bien". Decime: 1) ¿Es lógicamente correcto? 2) ¿Qué edge cases no cubre? 3) ¿Es seguro? 4) ¿Es eficiente? 5) ¿Dónde estoy asumiendo algo que no está garantizado?
(F) Checklist de veracidad: Corrección lógica → Edge cases → Seguridad → Eficiencia → Supuestos

--- Ejemplo ---
(R) Actuá como validador de veracidad
(C) Generaste un endpoint POST /api/orders con validación de stock
(T) Validá: condiciones de carrera, validación de input, atomicidad de la transacción, manejo de errores
(F) Checklist por sección con severity`,
  },
]
