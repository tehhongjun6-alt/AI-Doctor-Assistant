import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantMessage, type ChatMessage } from './AssistantMessage'
import { translations } from '../i18n'

describe('answerActions (Step 4)', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined)
  const t = translations.zh

  const testMessage: ChatMessage = {
    id: 'msg-1',
    role: 'assistant',
    content: '常见于 感冒后咳嗽',
    answer: {
      summary: '常见于 **感冒后咳嗽**',
      possibleCauses: ['普通感冒'],
      advice: ['多喝温水休息'],
      seekCareWhen: ['持续发烧'],
      urgency: 'low',
      disclaimer: '非正式诊断',
      followUpQuestions: [],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('calls navigator.clipboard.writeText with text containing summary on clicking copy', async () => {
    render(
      <AssistantMessage
        message={testMessage}
        t={t}
        displayContent={testMessage.content}
        onOpenMap={() => {}}
      />,
    )

    const copyBtn = screen.getByRole('button', { name: new RegExp(t.copyAnswer) })
    expect(copyBtn).toBeDefined()

    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1)
    })

    const copiedArg = writeTextMock.mock.calls[0][0]
    expect(copiedArg).toContain('常见于 感冒后咳嗽')
    expect(copiedArg).not.toContain('**')

    // Button updates text to "已复制"
    expect(screen.getByText(t.copied)).toBeDefined()
  })

  it('shares to WhatsApp when navigator.share is not available', () => {
    const originalShare = navigator.share
    // @ts-expect-error test override
    delete navigator.share

    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <AssistantMessage
        message={testMessage}
        t={t}
        displayContent={testMessage.content}
        onOpenMap={() => {}}
      />,
    )

    const shareBtn = screen.getByRole('button', { name: new RegExp(t.shareAnswer) })
    fireEvent.click(shareBtn)

    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock.mock.calls[0][0]).toContain('https://wa.me/?text=')

    openMock.mockRestore()
    if (originalShare) {
      Object.assign(navigator, { share: originalShare })
    }
  })

  it('does not render copy/share buttons when message has no answer', () => {
    const streamingMessage: ChatMessage = {
      id: 'msg-stream',
      role: 'assistant',
      content: '正在生成中的摘要...',
    }

    render(
      <AssistantMessage
        message={streamingMessage}
        t={t}
        displayContent={streamingMessage.content}
        onOpenMap={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: new RegExp(t.copyAnswer) })).toBeNull()
    expect(screen.queryByRole('button', { name: new RegExp(t.shareAnswer) })).toBeNull()
  })
})
