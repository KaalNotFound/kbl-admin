// VaultDoctorDashboard.tsx — Phase 5: Vault Doctor screen.
// Validates the vault (schema lint per directory) and lists every finding
// the tolerant finanzas parser would silently skip, plus the runtime
// per-source diagnostics. The tolerant parser stays untouched: this page
// is the observability OVER the tolerance ("robust against absence,
// fragile against garbage" → self-service audit). Findings group by file;
// every file row carries the Phase 1 provenance chip "Open in Obsidian ↗".
import { useEffect, useMemo, useState } from 'react'
import { fetchVaultDoctor } from '../api'
import type { VaultDoctorResponse, VaultDoctorFinding } from '../types'
import { HeroSkeleton, CardSkeleton } from './SkeletonFin'

function errorTitle() {
  return 'Error auditando el vault'
}

const KIND_LABELS: Record<string, string> = {
  missing_field: 'Campo faltante',
  bad_date: 'Fecha inválida',
  suspicious_price: 'Precio sospechoso',
  bad_quantity: 'Cantidad no numérica',
  bad_slot_format: 'Formato de franja inválido',
  suspicious_value: 'Valor sospechoso',
  bad_entry: 'Entrada inválida',
  unreadable_file: 'Archivo ilegible',
  duplicate_day: 'Día duplicado',
}

const ZONE_LABELS: Record<string, string> = {
  compras: 'Compras',
  food_sora: 'Daily / Food Sora',
  assets: 'Patrimonio',
  wallet: 'Wallet Paú',
}

// Filled-dot color language, reused from the Food Sora calendar
// (red → error, amber → warn, green → all clear).
const SEVERITY_DOT: Record<string, string> = {
  error: 'bg-kbl-red',
  warn: 'bg-kbl-amber',
}

function findingLabel(f: VaultDoctorFinding) {
  return KIND_LABELS[f.kind] || f.kind
}

export default function VaultDoctorDashboard() {
  const [data, setData] = useState<VaultDoctorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVaultDoctor()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const grouped = useMemo(() => {
    if (!data?.findings?.length) return []
    const byFile = new Map<string, VaultDoctorFinding[]>()
    for (const f of data.findings) {
      if (!byFile.has(f.file)) byFile.set(f.file, [])
      byFile.get(f.file)!.push(f)
    }
    // errors first, files inside each group keep arrival order
    const groups = Array.from(byFile.entries())
    return groups.sort((a, b) => {
      const maxSev = (g: [string, VaultDoctorFinding[]]) => g[1].some(f => f.severity === 'error') ? 0 : 1
      return maxSev(a) - maxSev(b) || a[0].localeCompare(b[0])
    })
  }, [data])

  const counts = useMemo(() => {
    const findings = data?.findings || []
    return {
      errors: findings.filter(f => f.severity === 'error').length,
      warns: findings.filter(f => f.severity === 'warn').length,
    }
  }, [data])

  if (loading) {
    return (
      <div className="flex flex-col gap-5 [&>*]:animate-card-enter">
        <HeroSkeleton />
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="flex items-center gap-[0.6rem] px-5 py-[0.9rem] bg-[rgba(224,138,122,0.06)] border border-[rgba(224,138,122,0.15)] rounded-[10px] text-[#e0a0a0] text-sm"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(224,138,122,0.15)] text-kbl-red font-bold text-[0.75rem]">!</span>{errorTitle()}</div>
  }

  if (!data) return null

  const { scanned, findings, diagnostics } = data

  return (
    <div data-testid="vault-doctor-body" className="flex flex-col gap-5 [&>*]:animate-card-enter">
      {/* Summary header — scanned per zone + findings by severity */}
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {Object.entries(scanned).map(([zone, n]) => (
          <div key={zone} className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
            <div className="text-[0.65rem] uppercase tracking-wider text-[#a0907e] font-semibold mb-1">{ZONE_LABELS[zone]}</div>
            <div className="text-[1.8rem] font-bold leading-tight text-kbl-blue">{n}</div>
            <div className="text-[0.6rem] text-[#a0907e]">archivos auditados</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className={`inline-flex items-center gap-2 text-[0.65rem] font-semibold px-[0.6rem] py-[0.2rem] rounded-full ${counts.errors ? 'bg-[rgba(224,138,122,0.12)] text-kbl-red' : 'bg-[rgba(143,202,160,0.1)] text-kbl-green'}`}>
          <span className={`inline-block w-[6px] h-[6px] rounded-full ${counts.errors ? 'bg-kbl-red' : 'bg-kbl-green'}`} />
          {counts.errors} {counts.errors === 1 ? 'error' : 'errores'}
        </span>
        <span className={`inline-flex items-center gap-2 text-[0.65rem] font-semibold px-[0.6rem] py-[0.2rem] rounded-full ${counts.warns ? 'bg-[rgba(232,184,75,0.1)] text-kbl-amber' : 'bg-[rgba(143,202,160,0.1)] text-kbl-green'}`}>
          <span className={`inline-block w-[6px] h-[6px] rounded-full ${counts.warns ? 'bg-kbl-amber' : 'bg-kbl-green'}`} />
          {counts.warns} {counts.warns === 1 ? 'advertencia' : 'advertencias'}
        </span>
        {/* Observability over the parser tolerance (never changes it) */}
        <span className="text-[0.65rem] text-[#a0907e] leading-relaxed">
          Los parsers son tolerantes: el contenido basura se saltea sin errores. Esta auditoría muestra exactamente qué se ignoró y por qué.
        </span>
      </div>

      {/* Findings grouped by file with severity dot + provenance chip */}
      {grouped.length === 0 ? (
        <div className="bg-card p-8 text-center" data-testid="vault-doctor-empty">
          <div className="text-[1.6rem] mb-2">🩺</div>
          <p className="text-sm font-semibold text-kbl-green mb-1">Todos los archivos del vault pasan la validación</p>
          <p className="text-[0.65rem] text-[#a0907e]">Sin hallazgos en {Object.values(scanned).reduce((a, b) => a + b, 0)} archivos auditados</p>
        </div>
      ) : (
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Hallazgos por archivo</h3>
            <span className="text-[0.6rem] font-semibold px-[0.5rem] py-[0.15rem] rounded-full bg-[rgba(224,138,122,0.08)] text-kbl-red">{grouped.length} {grouped.length === 1 ? 'archivo' : 'archivos'}</span>
          </div>
          <div className="flex flex-col gap-3">
            {grouped.map(([file, fs]) => {
              const hasError = fs.some(f => f.severity === 'error')
              return (
                <div key={file} className="border border-[rgba(232,184,75,0.08)] rounded-[10px] p-4" data-testid="vault-doctor-file-group">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-[7px] h-[7px] rounded-full flex-shrink-0 ${hasError ? 'bg-kbl-red' : 'bg-kbl-amber'}`} />
                      <span className="font-mono text-[0.7rem] text-[#f0e5d8] truncate">{file}</span>
                    </div>
                    <a
                      href={fs[0].obsidian_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir la nota fuente en Obsidian"
                      className="inline-flex items-center gap-1 text-[0.65rem] text-[#a0907e] border border-[rgba(232,184,75,0.15)] rounded-[4px] px-[0.3rem] py-[0.05rem] hover:text-kbl-blue hover:border-[rgba(232,184,75,0.35)] hover:bg-[rgba(232,184,75,0.06)] transition-colors flex-shrink-0"
                    >Open in Obsidian ↗</a>
                  </div>
                  <div className="flex flex-col gap-1">
                    {fs.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 py-[0.25rem] text-[0.7rem]">
                        <span className={`inline-block w-[6px] h-[6px] rounded-full flex-shrink-0 mt-[0.35rem] ${SEVERITY_DOT[f.severity]}`} />
                        <span className="text-[#a0907e] flex-shrink-0 w-[3.2rem] uppercase tracking-wider text-[0.6rem] mt-[0.2rem]">{f.severity === 'error' ? 'error' : 'aviso'}</span>
                        <span className="flex-shrink-0 text-[#c8b8a8] font-medium">{findingLabel(f)}{f.field ? <span className="text-[#a0907e]"> · {f.field}</span> : null}{f.line ? <span className="text-[#a0907e]"> · línea {f.line}</span> : null}</span>
                        <span className="text-[#a0907e] leading-relaxed">{f.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Runtime diagnostics (DB loader + watcher per-source status) */}
      <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
        <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider mb-4">Estado de fuentes en runtime</h3>
        {Object.keys(diagnostics.sources).length === 0 ? (
          <p className="text-sm text-[#a0907e]">Sin fuentes cargadas todavía (base no inicializada)</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(diagnostics.sources).map(([source, status]) => {
              const ok = /^ok:/.test(status)
              return (
                <span key={source} className="inline-flex items-center gap-2 text-[0.65rem] px-[0.6rem] py-[0.25rem] rounded-[6px] font-mono border"
                  style={{ borderColor: ok ? 'rgba(143,202,160,0.18)' : 'rgba(224,138,122,0.2)' }}>
                  <span className={`inline-block w-[6px] h-[6px] rounded-full ${ok ? 'bg-kbl-green' : 'bg-kbl-red'}`} />
                  <span className="text-[#f0e5d8]">{source}</span>
                  <span className={ok ? 'text-kbl-green' : 'text-[#e0a0a0]'}>{status}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
