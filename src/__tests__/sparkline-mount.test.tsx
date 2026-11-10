import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from '../components/Sparkline'

describe('Sparkline mount', () => {
  it('renders the svg chart with one point per data entry', () => {
    const data = [
      { fecha: '2026-11-08', total: 12 },
      { fecha: '2026-11-09', total: 34 },
      { fecha: '2026-11-10', total: 7 },
    ]
    const { container } = render(<Sparkline data={data} color="#8fcaa0" />)
    expect(container.querySelector('svg')).toBeTruthy()
    const points = container.querySelector('polyline')?.getAttribute('points') ?? ''
    // Three data entries -> three coordinate pairs in the polyline.
    expect(points.trim().split(' ')).toHaveLength(3)
  })

  it('renders nothing when there are fewer than two points', () => {
    const { container } = render(
      <Sparkline data={[{ fecha: '2026-11-09', total: 3 }]} color="#8fcaa0" />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})
