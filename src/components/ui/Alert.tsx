import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface AlertProps {
  variant: 'success' | 'warning' | 'error' | 'info'
  children: ReactNode
  autoDismiss?: number // ms, 0 = no auto-dismiss
  onDismiss?: () => void
  className?: string
}

const borderColor = {
  success: 'border-l-positive',
  warning: 'border-l-warning',
  error: 'border-l-danger',
  info: 'border-l-accent',
}

const bgColor = {
  success: 'bg-positive/5',
  warning: 'bg-warning/5',
  error: 'bg-danger/5',
  info: 'bg-accent/5',
}

export default function Alert({ variant, children, autoDismiss = 5000, onDismiss, className = '' }: AlertProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (autoDismiss > 0) {
      const timer = setTimeout(() => {
        setVisible(false)
        onDismiss?.()
      }, autoDismiss)
      return () => clearTimeout(timer)
    }
  }, [autoDismiss, onDismiss])

  if (!visible) return null

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-lg border-l-4 shadow-lg transition-all duration-300 ${borderColor[variant]} ${bgColor[variant]} ${className}`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-text-primary">{children}</span>
        <button
          onClick={() => { setVisible(false); onDismiss?.() }}
          className="text-text-tertiary hover:text-text-primary text-xs mt-0.5 shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
