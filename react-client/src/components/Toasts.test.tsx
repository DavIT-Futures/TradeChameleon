import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { showToast } from '../core/toast'
import { Toasts } from './Toasts'

describe('<Toasts>', () => {
  it('shows a toast from anywhere and dismisses it on click', async () => {
    render(<Toasts />)
    act(() => showToast('error', 'Insufficient funds', 'Only 10 GBP available'))
    expect(screen.getByText('Insufficient funds')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Insufficient funds')).not.toBeInTheDocument()
  })
})
