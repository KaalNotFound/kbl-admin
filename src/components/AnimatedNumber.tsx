import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
}

export default function AnimatedNumber({ value, duration = 800, prefix = '', suffix = '' }: Props) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    fromRef.current = display
    const start = performance.now()
    const from = fromRef.current
    const diff = value - from
    if (diff === 0) return

    const frame = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + diff * ease))
      if (progress < 1) rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return (
    <span className="num [font-variant-numeric:tabular-nums]">
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  )
}
