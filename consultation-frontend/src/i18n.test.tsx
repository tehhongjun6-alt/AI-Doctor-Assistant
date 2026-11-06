import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { translations } from './i18n'

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

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body }
}

const structuredAnswerMalay = {
  success: true,
  data: {
    conversationId: 'conversation-ms-1',
    messageId: 'message-ms-1',
    answer: {
      summary: 'Anda menyatakan bahawa anda mengalami sakit kepala selama dua hari.',
      followUpQuestions: ['Adakah anda mengalami demam?'],
      possibleCauses: ['Sakit kepala tegang atau jangkitan virus'],
      urgency: 'low',
      advice: ['Berehat secukupnya dan minum banyak air.'],
      seekCareWhen: ['Jika sakit kepala menjadi sangat teruk secara tiba-tiba.'],
      disclaimer: 'Ini bukan diagnosis perubatan rasmi.',
    },
    sources: [],
  },
}

describe('i18n Malay (Step 11b)', () => {
  beforeEach(() => {
    seedSession()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('switches to BM, displays translations.ms.welcomeTitle, and sends language as ms in chat requests', async () => {
    let capturedChatBody: Record<string, unknown> | null = null

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/conversations')) {
          return jsonResponse({ conversations: [], limit: 3 })
        }
        if (url.includes('/api/chat')) {
          if (init?.body && typeof init.body === 'string') {
            try {
              capturedChatBody = JSON.parse(init.body)
            } catch {
              /* ignore */
            }
          }
          return jsonResponse(structuredAnswerMalay)
        }
        return jsonResponse({})
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<App />)

    // Click BM in the language toggle
    const bmButtons = screen.getAllByRole('button', { name: 'BM' })
    await user.click(bmButtons[0])

    // Document language attribute should be updated to 'ms'
    expect(document.documentElement.lang).toBe('ms')

    // Welcome title should switch to translations.ms.welcomeTitle
    expect(await screen.findByText(translations.ms.welcomeTitle)).toBeTruthy()

    // Type a message in Malay and send
    const input = screen.getByLabelText(translations.ms.inputAria)
    await user.type(input, 'Saya sakit kepala dua hari.')
    const sendButton = screen.getByRole('button', {
      name: translations.ms.sendAria,
    })
    await user.click(sendButton)

    // Verify response rendered in Malay
    expect(
      await screen.findByText(
        'Anda menyatakan bahawa anda mengalami sakit kepala selama dua hari.',
      ),
    ).toBeTruthy()

    // Verify the chat request payload had language: 'ms'
    expect(capturedChatBody).not.toBeNull()
    const payload = capturedChatBody as unknown as Record<string, unknown>
    expect(payload.language).toBe('ms')
    expect(payload.message).toBe('Saya sakit kepala dua hari.')
  })
})
