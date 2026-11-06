import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatPanel from './ChatPanel'
import { getConversation } from '../services/conversationService'
import { requestChat } from '../services/chatService'

vi.mock('../services/conversationService', () => ({
  getConversation: vi.fn(),
}))

vi.mock('../services/chatService', () => ({
  requestChat: vi.fn(),
  isAbortError: vi.fn().mockReturnValue(false),
}))

describe('regenerate frontend (Step 6)', () => {
  const getConversationMock = vi.mocked(getConversation)
  const requestChatMock = vi.mocked(requestChat)

  const twoTurnMessages = [
    {
      id: 'msg-u1',
      role: 'user' as const,
      content: '第一轮：头痛两天',
    },
    {
      id: 'msg-a1',
      role: 'assistant' as const,
      content: '第一轮回答摘要',
      answer: {
        summary: '第一轮回答摘要',
        possibleCauses: ['原因 1'],
        advice: ['建议 1'],
        seekCareWhen: ['危险 1'],
        urgency: 'low' as const,
        disclaimer: '免责 1',
        followUpQuestions: [],
      },
    },
    {
      id: 'msg-u2',
      role: 'user' as const,
      content: '第二轮：发烧 38.5 度',
    },
    {
      id: 'msg-a2',
      role: 'assistant' as const,
      content: '第二轮回答摘要',
      answer: {
        summary: '第二轮回答摘要',
        possibleCauses: ['原因 2'],
        advice: ['建议 2'],
        seekCareWhen: ['危险 2'],
        urgency: 'medium' as const,
        disclaimer: '免责 2',
        followUpQuestions: [],
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('only shows the regenerate button on the last assistant message and includes regenerate: true in request', async () => {
    getConversationMock.mockResolvedValueOnce({
      status: 'ok',
      messages: twoTurnMessages,
    })

    requestChatMock.mockImplementation(async () => {
      // Simulate unresolved or resolved request
      return {
        ok: true,
        result: {
          success: true,
          data: {
            conversationId: 'conv-test-123',
            answer: {
              summary: '重新生成的回答摘要',
              possibleCauses: ['新原因'],
              advice: ['新建议'],
              seekCareWhen: ['新危险'],
              urgency: 'low',
              disclaimer: '免责',
              followUpQuestions: [],
            },
          },
        },
      }
    })

    render(
      <ChatPanel
        initialConversationId="conv-test-123"
        onOpenMap={() => {}}
        lang="zh"
      />,
    )

    // Wait for history to load
    await waitFor(() => {
      expect(screen.getByText('第一轮回答摘要')).toBeDefined()
      expect(screen.getByText('第二轮回答摘要')).toBeDefined()
    })

    // Verify only 1 "重新回答" button exists across the entire conversation
    const regenButtons = screen.getAllByRole('button', { name: '重新回答' })
    expect(regenButtons).toHaveLength(1)

    // Click "重新回答"
    fireEvent.click(regenButtons[0])

    // Verify requestChat was invoked with regenerate: true, conversationId, and the last user message
    await waitFor(() => {
      expect(requestChatMock).toHaveBeenCalledTimes(1)
      expect(requestChatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-test-123',
          message: '第二轮：发烧 38.5 度',
          regenerate: true,
        }),
        expect.any(Function),
        expect.any(Object),
      )
    })
  })
})
