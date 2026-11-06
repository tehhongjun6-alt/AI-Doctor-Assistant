import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { translations } from '../i18n'

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

describe('deleteAccount frontend (Step 7)', () => {
  const t = translations.zh

  afterEach(() => {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('disables confirm button when password is empty, and calls DELETE /api/account on confirm', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onClose = vi.fn()
    const onSuccess = vi.fn()

    render(
      <DeleteAccountDialog
        t={t}
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    )

    // Confirm button is disabled when password is empty
    const confirmBtn = screen.getByRole('button', { name: t.deleteAccountConfirmBtn })
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true)

    // Type password
    const passwordInput = screen.getByPlaceholderText(t.deleteAccountPasswordPlaceholder)
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false)

    // Click confirm
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/account'),
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ password: 'password123' }),
        }),
      )
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('displays wrong password and too many attempts errors properly', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: { code: 'WRONG_PASSWORD' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ success: false, error: { code: 'TOO_MANY_ATTEMPTS' } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DeleteAccountDialog
        t={t}
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: t.deleteAccountConfirmBtn })
    const passwordInput = screen.getByPlaceholderText(t.deleteAccountPasswordPlaceholder)

    // Attempt 1: 401
    fireEvent.change(passwordInput, { target: { value: 'wrong-pass' } })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText(t.wrongPassword)).toBeDefined()
    })

    // Attempt 2: 429
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText(t.tooManyAttempts)).toBeDefined()
    })
  })

  it('full flow in App: opens dialog from sidebar, deletes account, and returns to landing page', async () => {
    seedSession()
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations')) {
        return { ok: true, status: 200, json: async () => ({ conversations: [], limit: 3 }) }
      }
      if (url.includes('/api/account') && init?.method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) }
      }
      return { ok: true, status: 200, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    // Verify logged in
    expect(screen.getByText('tester@example.com')).toBeDefined()

    // Find and click "删除账号" in sidebar
    const deleteBtn = screen.getByRole('button', { name: t.deleteAccount })
    await user.click(deleteBtn)

    // Dialog is visible
    expect(screen.getByText(t.deleteAccountWarning)).toBeDefined()

    // Confirm button disabled initially
    const confirmBtn = screen.getByRole('button', { name: t.deleteAccountConfirmBtn })
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true)

    // Enter password
    const input = screen.getByPlaceholderText(t.deleteAccountPasswordPlaceholder)
    await user.type(input, 'my-password')
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false)

    // Confirm
    await user.click(confirmBtn)

    // Returns to landing page
    await waitFor(() => {
      expect(localStorage.getItem('ai_doc_auth_session')).toBeNull()
      expect(screen.getByRole('button', { name: '登录' })).toBeDefined()
    })
  })
})
