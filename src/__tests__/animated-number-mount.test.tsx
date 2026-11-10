import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AnimatedNumber from '../components/AnimatedNumber'

describe('AnimatedNumber mount', () => {
  it('animates through requestAnimationFrame and settles on the target value', async () => {
    // A value below 1000 avoids toLocaleString() grouping, so the anchor text
    // is identical in any runtime locale. Short duration keeps the rAF loop
    // well inside the findBy* default timeout.
    render(<AnimatedNumber value={742} duration={50} />)
    expect(await screen.findByText('742')).toBeTruthy()
  })
})
