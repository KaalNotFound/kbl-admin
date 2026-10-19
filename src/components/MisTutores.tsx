import { TUTORES, type TutorProfile } from '../data/tutores'

export default function MisTutores() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-xl p-4 border-l-4 border-accent mb-4">
        <p className="text-sm text-text-secondary">
          🤖 <strong className="text-text-primary">Mis Tutores</strong> — 
          System prompts listos para configurar como instrucción de sistema 
          en ChatGPT, Claude, Gemini o cualquier modelo. Copiá el tutor, 
          cargalo como system prompt, y usá los iniciadores para arrancar.
        </p>
      </div>

      {TUTORES.map(tutor => (
        <TutorCard key={tutor.id} tutor={tutor} />
      ))}
    </div>
  )
}

function TutorCard({ tutor }: { tutor: TutorProfile }) {
  const copySystem = async () => {
    try {
      await navigator.clipboard.writeText(tutor.systemPrompt)
      showFeedback(`sp-${tutor.id}`, '✅')
    } catch {
      // fallback
    }
  }

  const copyStarter = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showFeedback(`st-${tutor.id}`, '✅')
    } catch {
      // fallback
    }
  }

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border-light">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2">
          <span className="text-xl">{tutor.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{tutor.name}</h3>
              {tutor.tags.map(t => (
                <span key={t} className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-surface text-text-tertiary border border-border-light">
                  {t}
                </span>
              ))}
            </div>
            <p className="text-[0.65rem] text-text-tertiary mt-0.5">{tutor.desc}</p>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="px-4 py-3 border-b border-border-light">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">System Prompt</span>
          <button
            id={`sp-${tutor.id}`}
            onClick={copySystem}
            className="px-2.5 py-1 text-[0.65rem] font-medium rounded-lg bg-surface text-text-secondary hover:bg-border-light transition-colors"
          >
            📋 Copiar System Prompt
          </button>
        </div>
        <pre className="text-xs text-text-primary font-mono leading-relaxed whitespace-pre-wrap bg-page rounded-lg p-3 border border-border-light max-h-40 overflow-y-auto">
          {tutor.systemPrompt}
        </pre>
      </div>

      {/* Starters */}
      <div className="px-4 py-3">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
          Iniciadores de Conversación
        </span>
        <div className="flex flex-wrap gap-2">
          {tutor.starters.map((s, i) => (
            <button
              key={i}
              id={`st-${tutor.id}-${i}`}
              onClick={() => copyStarter(s)}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface text-text-secondary hover:bg-border-light border border-border-light transition-colors text-left max-w-full"
              title="Click para copiar"
            >
              💬 {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Simple feedback helper (toggles button text temporarily)
function showFeedback(elementId: string, icon: string) {
  const el = document.getElementById(elementId)
  if (!el) return
  const original = el.textContent || ''
  el.textContent = `${icon} ¡Copiado!`
  setTimeout(() => { el.textContent = original }, 1500)
}
