import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import GuidePanel from './GuidePanel'

function renderPanel() {
  return render(<GuidePanel lang="zh" onOpenMenu={() => {}} onAsk={() => {}} />)
}

function cards() {
  return within(screen.getByRole('list')).getAllByRole('button')
}

describe('GuidePanel', () => {
  afterEach(() => cleanup())

  it('shows 20 topic cards', () => {
    renderPanel()
    expect(cards()).toHaveLength(20)
  })

  it('filters to the 3 emergency topics', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: '认识急症' }))
    expect(cards()).toHaveLength(3)
  })

  it('opens dengue details and closes with Escape', async () => {
    const user = userEvent.setup()
    renderPanel()
    const card = screen.getByRole('button', { name: /骨痛热症/ })
    await user.click(card)

    const dialog = screen.getByRole('dialog', { name: '骨痛热症' })
    expect(within(dialog).getByRole('heading', { name: '什么时候要立刻看医生' })).toBeTruthy()
    const source = within(dialog).getByRole('link', { name: 'WHO' })
    expect(source.getAttribute('href')).toMatch(/^https:\/\//)
    expect(source.getAttribute('target')).toBe('_blank')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(card)
  })
})
