import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const INPUT_LABEL = '请输入你的症状、问题或相关描述...'

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

const structuredAnswer = {
  success: true,
  data: {
    conversationId: 'conversation-1',
    messageId: 'message-1',
    answer: {
      summary: '你描述了持续两天的喉咙痛。',
      followUpQuestions: ['是否发烧？'],
      possibleCauses: ['上呼吸道感染等多种可能'],
      urgency: 'low',
      advice: ['休息并补充水分。'],
      seekCareWhen: ['症状明显加重。'],
      disclaimer: '这不是正式医疗诊断。',
    },
    sources: [
      { title: 'Sore Throat', url: 'https://medlineplus.gov/sorethroat.html' },
    ],
  },
}

describe('login gate', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('shows the sign-in page when there is no session', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: '登录' })).toBeTruthy()
    expect(screen.queryByLabelText(INPUT_LABEL)).toBeNull()
  })
})

describe('consultation shell', () => {
  beforeEach(() => {
    seedSession()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('sends a message and displays the structured AI answer with sources', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(structuredAnswer))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText(INPUT_LABEL)
    const sendButton = screen.getByRole('button', { name: '发送消息' })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)

    await user.type(input, '我的喉咙痛了两天。')
    await user.click(sendButton)

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    expect(screen.getByText('休息并补充水分。')).toBeTruthy()
    expect(screen.getByText('风险较低')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Sore Throat/ })).toBeTruthy()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer test-token',
    )
  })

  it('shows the streamed summary first, then the full checked answer', async () => {
    const encoder = new TextEncoder()
    let push: (text: string) => void = () => {}
    let close: () => void = () => {}
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (text) => controller.enqueue(encoder.encode(text))
        close = () => controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我的喉咙痛了两天。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    push('event: delta\ndata: {"summary":"正在分析你的喉咙痛"}\n\n')
    expect(await screen.findByText('正在分析你的喉咙痛')).toBeTruthy()

    push(`event: final\ndata: ${JSON.stringify({ status: 200, body: structuredAnswer })}\n\n`)
    close()

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    expect(screen.getByText('休息并补充水分。')).toBeTruthy()
    expect(screen.queryByText('正在分析你的喉咙痛')).toBeNull()
    expect(fetchMock.mock.calls[0][0]).toContain('/api/chat/stream')
  })

  it('falls back to the regular endpoint when streaming is not deployed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 404))
      .mockResolvedValueOnce(jsonResponse(structuredAnswer))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我的喉咙痛了两天。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/chat$/)
  })

  it('sends with Enter and keeps Shift+Enter for new lines', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(structuredAnswer))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText(INPUT_LABEL) as HTMLTextAreaElement
    await user.type(input, '第一行{Shift>}{Enter}{/Shift}第二行')
    expect(input.value).toBe('第一行\n第二行')
    expect(fetchMock).not.toHaveBeenCalled()

    await user.type(input, '{Enter}')
    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('asks a quick prompt with one click', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(structuredAnswer))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: '我发烧 38.5 度，头痛两天了' }),
    )

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.message).toBe('我发烧 38.5 度，头痛两天了')
  })

  it('shows an error and allows retrying the same message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { success: false, error: { message: 'AI 服务暂时无法使用。' } },
        false,
        502,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我头痛。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('AI 服务暂时无法使用。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
  })

  it('returns to the sign-in page when the backend rejects the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { success: false, error: { message: '登录已过期，请重新登录。' } },
          false,
          401,
        ),
      ),
    )
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我头痛。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByRole('tab', { name: '登录' })).toBeTruthy()
    expect(localStorage.getItem('ai_doc_auth_session')).toBeNull()
  })
})
