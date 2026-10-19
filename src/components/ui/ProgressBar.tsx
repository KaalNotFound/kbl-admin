interface ProgressBarProps {
  value: number // 0-100
  max?: number
  label?: string
  showCount?: boolean
  className?: string
}

export default function ProgressBar({ value, max = 100, label, showCount = false, className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={`w-full ${className}`}>
      {(label || showCount) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showCount && <span className="text-xs text-text-tertiary">{value} / {max}</span>}
        </div>
      )}
      <div className="w-full h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
