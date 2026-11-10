import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Skeleton, { CardSkeleton, HeroSkeleton } from '../components/SkeletonFin'

describe('SkeletonFin mount', () => {
  it('Skeleton renders the default three placeholder lines', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(3)
  })

  it('Skeleton honors the lines prop', () => {
    const { container } = render(<Skeleton lines={5} height={16} />)
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(5)
  })

  it('CardSkeleton renders its header line plus four body lines', () => {
    const { container } = render(<CardSkeleton />)
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(5)
  })

  it('HeroSkeleton renders its three stat lines', () => {
    const { container } = render(<HeroSkeleton />)
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(3)
  })
})
