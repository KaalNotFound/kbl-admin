import type { PseudocodeMeta } from '../../algorithms/frameTypes'

/**
 * Shared pseudo-code trace panel — the exact visual design of the original
 * Bubble-only CodeTracePanel, reused by all 8 visualizer tabs via
 * SortVisualizer (meta.pseudocode) and optionally by per-algorithm asides.
 */

interface PseudoCodePanelProps {
  pseudocode: PseudocodeMeta
  activeIndex: number | null
}

export default function PseudoCodePanel({ pseudocode, activeIndex }: PseudoCodePanelProps) {
  return (
    <div className="bg-card rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Punto de ejecución</h3>
      <pre className="mono text-[0.7rem] leading-relaxed overflow-x-auto whitespace-pre">
        {pseudocode.lines.map((line, idx) => (
          <div
            key={idx}
            className={`px-2 -mx-1 rounded transition-colors ${
              idx === activeIndex ? 'bg-accent-light text-accent font-semibold' : 'text-text-secondary'
            }`}
          >
            <span className="text-text-tertiary select-none mr-2">{String(idx + 1).padStart(2, ' ')}</span>
            {line}
          </div>
        ))}
      </pre>
    </div>
  )
}
