import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export default function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <div className={`card ${hover ? '' : 'hover:transform-none hover:shadow-none'} ${className}`}>
      {children}
    </div>
  )
}
