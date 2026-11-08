import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { GUIDE_TOPICS } from './guideTopics'

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

function stubFetch(conversationCount: number) {
  const conversations = Array.from({ length: conversationCount }, (_, i) => ({
    id: `c${i + 1}`,
    title: `对话 ${i + 1}`,
    messageCount: 2,
    updatedAt: new Date().toISOString(),
  }))
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => ({ conversations, limit: 3 }),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function chatCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/chat'))
}

async function askAboutDengue() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '健康指南' }))
  await user.click(screen.getByRole('button', { name: /骨痛热症/ }))
  const dialog = screen.getByRole('dialog', { name: '骨痛热症' })
  await user.click(within(dialog).getByRole('button', { name: '问 Medora' }))
}

describe('Ask Medora from the health guide', () => {
  const dengue = GUIDE_TOPICS.find((t) => t.id === 'dengue')!

  beforeEach(() => seedSession())

  afterEach(() => {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('switches to chat and fills the input without sending', async () => {
    const fetchMock = stubFetch(0)
    await askAboutDengue()

    const input = screen.getByLabelText(INPUT_LABEL) as HTMLTextAreaElement
    expect(input.value).toBe(dengue.askPrompt.zh)
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('heading', { name: '健康指南', level: 1 })).toBeNull()
    expect(chatCalls(fetchMock)).toHaveLength(0)
  })

  it('still fills the input when 3 conversations already exist', async () => {
    const fetchMock = stubFetch(3)
    await askAboutDengue()

    const input = screen.getByLabelText(INPUT_LABEL) as HTMLTextAreaElement
    expect(input.value).toBe(dengue.askPrompt.zh)
    expect(chatCalls(fetchMock)).toHaveLength(0)
  })
})
