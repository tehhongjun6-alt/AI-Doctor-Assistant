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
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/conversations')) {
          return jsonResponse({ conversations: [], limit: 3 })
        }
        return jsonResponse(structuredAnswer)
      },
    )
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

    const chatCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/chat'),
    )
    expect(chatCall).toBeDefined()
    const [, init] = chatCall!
    expect(new Headers(init?.headers).get('Authorization')).toBe(
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: [], limit: 3 })
      }
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我的喉咙痛了两天。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    push('event: delta\ndata: {"summary":"正在分析你的喉咙痛"}\n\n')
    expect(await screen.findByText('正在分析你的喉咙痛')).toBeTruthy()

    push(
      `event: final\ndata: ${JSON.stringify({ status: 200, body: structuredAnswer })}\n\n`,
    )
    close()

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    expect(screen.getByText('休息并补充水分。')).toBeTruthy()
    expect(screen.queryByText('正在分析你的喉咙痛')).toBeNull()
    const streamCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/chat/stream'),
    )
    expect(streamCall).toBeDefined()
  })

  it('falls back to the regular endpoint when streaming is not deployed', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: [], limit: 3 })
      }
      if (url.includes('/api/chat/stream')) {
        return jsonResponse({}, false, 404)
      }
      return jsonResponse(structuredAnswer)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我的喉咙痛了两天。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    const regularCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/api/chat'),
    )
    expect(regularCall).toBeDefined()
  })

  it('sends with Enter and keeps Shift+Enter for new lines', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/conversations')) {
          return jsonResponse({ conversations: [], limit: 3 })
        }
        return jsonResponse(structuredAnswer)
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText(INPUT_LABEL) as HTMLTextAreaElement
    await user.type(input, '第一行{Shift>}{Enter}{/Shift}第二行')
    expect(input.value).toBe('第一行\n第二行')

    const chatCallsBefore = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/chat'),
    )
    expect(chatCallsBefore).toHaveLength(0)

    await user.type(input, '{Enter}')
    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    const chatCallsAfter = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/chat'),
    )
    expect(chatCallsAfter).toHaveLength(1)
  })

  it('asks a quick prompt with one click', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/conversations')) {
          return jsonResponse({ conversations: [], limit: 3 })
        }
        return jsonResponse(structuredAnswer)
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: '我发烧 38.5 度，头痛两天了' }),
    )

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    const chatCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/chat'),
    )
    expect(chatCall).toBeDefined()
    const body = JSON.parse(chatCall![1]?.body as string)
    expect(body.message).toBe('我发烧 38.5 度，头痛两天了')
  })

  it('shows an error and allows retrying the same message', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: [], limit: 3 })
      }
      return jsonResponse(
        { success: false, error: { message: 'AI 服务暂时无法使用。' } },
        false,
        502,
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我头痛。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('AI 服务暂时无法使用。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
  })

  it('returns to the sign-in page when the backend rejects the token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: [], limit: 3 })
      }
      return jsonResponse(
        { success: false, error: { message: '登录已过期，请重新登录。' } },
        false,
        401,
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '我头痛。')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByRole('tab', { name: '登录' })).toBeTruthy()
    expect(localStorage.getItem('ai_doc_auth_session')).toBeNull()
  })
})

describe('multi-conversation frontend (Step 5)', () => {
  beforeEach(() => {
    seedSession()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('displays the conversation list and TTL notice', async () => {
    const sampleConversations = [
      {
        id: 'c1',
        title: '喉咙痛发烧两天',
        messageCount: 2,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'c2',
        title: '轻微咳嗽',
        messageCount: 4,
        updatedAt: new Date().toISOString(),
      },
    ]

    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: sampleConversations, limit: 3 })
      }
      return jsonResponse(structuredAnswer)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findAllByText('喉咙痛发烧两天')).toBeTruthy()
    expect(screen.getAllByText('轻微咳嗽').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2/3').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/30 天没有新消息会自动删除/).length,
    ).toBeGreaterThan(0)
  })

  it('disables the new conversation button and displays full when 3 conversations exist', async () => {
    const fullConversations = [
      { id: 'c1', title: '对话 1', messageCount: 2, updatedAt: new Date().toISOString() },
      { id: 'c2', title: '对话 2', messageCount: 2, updatedAt: new Date().toISOString() },
      { id: 'c3', title: '对话 3', messageCount: 2, updatedAt: new Date().toISOString() },
    ]

    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: fullConversations, limit: 3 })
      }
      return jsonResponse(structuredAnswer)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const fullButtons = await screen.findAllByRole('button', { name: '已满 3/3' })
    expect(fullButtons.length).toBeGreaterThan(0)
    expect((fullButtons[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('confirms and calls DELETE when deleting a conversation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const initialConversations = [
      {
        id: 'conv-del-1',
        title: '需要删除的对话',
        messageCount: 2,
        updatedAt: new Date().toISOString(),
      },
    ]

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations/conv-del-1') && init?.method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) }
      }
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: initialConversations, limit: 3 })
      }
      return jsonResponse(structuredAnswer)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findAllByText('需要删除的对话')).toBeTruthy()

    const deleteButtons = screen.getAllByRole('button', {
      name: /删除此对话: 需要删除的对话/,
    })
    await user.click(deleteButtons[0])

    expect(window.confirm).toHaveBeenCalledWith(
      '确定要删除这个对话吗？删除后将无法恢复。',
    )
    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes('/api/conversations/conv-del-1') &&
        init?.method === 'DELETE',
    )
    expect(deleteCall).toBeDefined()
  })

  it('selecting a conversation calls GET /api/conversations/:id and loads messages', async () => {
    const conversationList = [
      {
        id: 'conv-detail-1',
        title: '历史腰痛咨询',
        messageCount: 2,
        updatedAt: new Date().toISOString(),
      },
    ]

    const detailPayload = {
      conversation: {
        id: 'conv-detail-1',
        title: '历史腰痛咨询',
        messageCount: 2,
      },
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: '医生我腰痛两天了',
          isEmergency: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'm2',
          role: 'assistant',
          content: '腰痛可能因肌肉劳损引起',
          answer: {
            summary: '腰痛可能因肌肉劳损引起',
            followUpQuestions: [],
            possibleCauses: [],
            urgency: 'low',
            advice: ['保持平躺休息'],
            seekCareWhen: [],
            disclaimer: '仅供参考',
          },
          isEmergency: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/conversations/conv-detail-1')) {
        return jsonResponse(detailPayload)
      }
      if (url.includes('/api/conversations')) {
        return jsonResponse({ conversations: conversationList, limit: 3 })
      }
      return jsonResponse(structuredAnswer)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)

    const convElements = await screen.findAllByText('历史腰痛咨询')
    await user.click(convElements[0])

    expect(await screen.findByText('医生我腰痛两天了')).toBeTruthy()
    expect(screen.getByText('腰痛可能因肌肉劳损引起')).toBeTruthy()
    expect(screen.getByText('保持平躺休息')).toBeTruthy()
  })

  it('chat request payload does not contain history', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/conversations')) {
          return jsonResponse({ conversations: [], limit: 3 })
        }
        return jsonResponse(structuredAnswer)
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '无历史发送校验')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()

    const chatCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/chat'),
    )
    expect(chatCall).toBeDefined()
    const requestBody = JSON.parse(chatCall![1]?.body as string)
    expect(requestBody).not.toHaveProperty('history')
    expect(requestBody.message).toBe('无历史发送校验')
  })

  it('displays "查看附近诊所和药房" when response has mapCareLevel: clinic', async () => {
    const clinicAnswer = {
      success: true,
      data: {
        conversationId: 'conversation-1',
        messageId: 'message-clinic-1',
        answer: {
          summary: '轻微感冒症状，建议多喝温水。',
          followUpQuestions: [],
          possibleCauses: ['普通感冒'],
          urgency: 'low',
          advice: ['多喝温水，保证充足睡眠。'],
          seekCareWhen: ['持续高热不退。'],
          disclaimer: '这不是正式医疗诊断。',
        },
        mapCareLevel: 'clinic',
        sources: [],
      },
    }

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/conversations')) {
          return jsonResponse({ conversations: [], limit: 3 })
        }
        return jsonResponse(clinicAnswer)
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)

    await user.type(screen.getByLabelText(INPUT_LABEL), '有点轻微流鼻涕')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('轻微感冒症状，建议多喝温水。')).toBeTruthy()
    const clinicBtn = screen.getByRole('button', {
      name: '查看附近诊所和药房',
    })
    expect(clinicBtn).toBeTruthy()
  })
})
