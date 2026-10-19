import { useId } from 'react'

export function Sparkline({ data, color }: { data?: { fecha: string; total: number }[]; color: string }) {
  const id = useId()
  if (!data || data.length < 2) return null
  const max = Math.max(...data.map(d => d.total), 1)
  const w = 280; const h = 56
  const px = w / (data.length - 1)
  const pts = data.map((d, i) => `${i * px},${h - (d.total / max) * h * 0.85}`).join(' ')
  const area = `M0,${h} ${data.map((d, i) => `${i * px},${h - (d.total / max) * h * 0.85}`).join(' ')} ${(data.length - 1) * px},${h}Z`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(' ').pop()!.split(',')[0]} cy={pts.split(' ').pop()!.split(',')[1]} r="3" fill={color} />
    </svg>
  )
}
