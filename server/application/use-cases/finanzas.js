/**
 * FinanzasUseCases — Use Case collection (Torre finanzas, ADR-025)
 *
 * Re-capetización del router finanzas-router.mjs: el router deja de importar lib/
 * (violación §2.1, excepción ca-boundary-debt ADR-025) y recibe la lógica por
 * factory (DI container). Este use-case es un orquestador delgado: recibe
 * `ensureDb` (puerto de datos, I/O) y `calc` (funciones de cálculo) como deps
 * e inyectadas — no importa nada de lib/ ni instancia adapters.
 *
 * NOTA: Result pattern NO se adopta acá — deuda preservada separada
 * (roadmap.md L99, ADR-024: "0 Result pattern (deuda preservada, NO mezclada
 * con el split)"). Los errores se propagan al router que los captura.
 *
 * @param {{ ensureDb: () => Promise<boolean>, calc: object }} deps
 * @returns {{
 *   getSummary: (month: string) => Promise<object>,
 *   getInsights: (month: string) => Promise<object>,
 *   search: (q: string, store: string) => Promise<Array>,
 *   compare: (q: string) => Promise<object>,
 *   getFoodSoraStats: () => Promise<object>,
 *   getFoodSoraData: () => Promise<Array>,
 *   getFinanzas: () => Promise<object>,
 *   getPatrimonio: () => Promise<object>,
 * }}
 */
export function createFinanzasUseCases({ ensureDb, calc }) {
  return {
    getSummary: async (month) => {
      await ensureDb();
      return calc.calculateSummary(month);
    },
    getInsights: async (month) => {
      await ensureDb();
      return calc.calculateInsights(month);
    },
    search: async (q, store) => {
      await ensureDb();
      return calc.searchItems(q, store);
    },
    compare: async (q) => {
      await ensureDb();
      return calc.compareItems(q);
    },
    getFoodSoraStats: async () => {
      await ensureDb();
      return calc.getFoodSoraStats();
    },
    getFoodSoraData: async () => {
      await ensureDb();
      return calc.getFoodSoraData();
    },
    getFinanzas: async () => {
      await ensureDb();
      return calc.calculateFinanzas();
    },
    getPatrimonio: async () => {
      await ensureDb();
      return calc.calculatePatrimonio();
    },
  };
}
