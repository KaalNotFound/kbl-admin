interface BadgeProps {
  variant: 'good' | 'warn' | 'bad' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeProps['variant'], string> = {
  good: 'badge-connected',
  warn: 'bg-warning/10 text-warning',
  bad: 'badge-disconnected',
  info: 'bg-accent/10 text-accent',
  neutral: 'bg-bg-hover text-text-secondary',
}

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`badge ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}
