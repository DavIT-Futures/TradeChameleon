import { render, screen } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('<Sparkline>', () => {
  it('is accessible and marks a rising series', () => {
    render(<Sparkline values={[1, 2, 3]} />)
    const svg = screen.getByRole('img', { name: 'Rising' })
    expect(svg).toHaveClass('sparkline', 'up')
  })

  it('marks a falling series', () => {
    render(<Sparkline values={[3, 2, 1]} />)
    expect(screen.getByRole('img', { name: 'Falling' })).toHaveClass('down')
  })
})
