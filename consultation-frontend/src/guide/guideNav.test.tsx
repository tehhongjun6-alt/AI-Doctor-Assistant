import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

function seedSession() {
  localStorage.setItem(
    'ai_doc_auth_session',
    JSON.stringify({
      token: 'test-token',
      expiresAt: Date.now() + 60 * 60 * 1000,
      user: { id: 'user-1', email: 'tester@example.com' },
    }),
  )
}

describe('health guide navigation', () => {
  beforeEach(() => {
    seedSession()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ conversations: [], limit: 3 }) })),
    )
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('opens the health guide page from the sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByRole('heading', { name: '健康指南', level: 1 })).toBeNull()

    await user.click(screen.getByRole('button', { name: '健康指南' }))
    expect(screen.getByRole('heading', { name: '健康指南', level: 1 })).toBeTruthy()
  })

  it('shows Malay navigation and title after switching to BM', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'BM' }))
    await user.click(screen.getByRole('button', { name: 'Panduan Kesihatan' }))
    expect(screen.getByRole('heading', { name: 'Panduan Kesihatan', level: 1 })).toBeTruthy()
  })
})
