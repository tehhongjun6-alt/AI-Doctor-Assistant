import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatPanel from './ChatPanel'
import { translations } from '../i18n'

class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((ev: { error: string }) => void) | null = null
  onresult: ((ev: unknown) => void) | null = null

  static lastInstance: MockSpeechRecognition | null = null

  constructor() {
    MockSpeechRecognition.lastInstance = this
  }

  start = vi.fn().mockImplementation(() => {
    this.onstart?.()
  })

  stop = vi.fn().mockImplementation(() => {
    this.onend?.()
  })

  abort = vi.fn().mockImplementation(() => {
    this.onend?.()
  })
}

describe('speechInput frontend (Step 10)', () => {
  const t = translations.zh

  beforeEach(() => {
    MockSpeechRecognition.lastInstance = null
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  afterEach(() => {
    cleanup()
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  it('displays microphone button when supported, and hides it when not supported', () => {
    // 1. Not supported
    const { unmount } = render(<ChatPanel lang="zh" onOpenMap={() => {}} />)
    expect(screen.queryByRole('button', { name: t.micStart })).toBeNull()
    unmount()

    // 2. Supported via webkitSpeechRecognition
    window.webkitSpeechRecognition = MockSpeechRecognition as unknown as typeof window.webkitSpeechRecognition
    render(<ChatPanel lang="zh" onOpenMap={() => {}} />)
    expect(screen.getByRole('button', { name: t.micStart })).toBeDefined()
    expect(screen.getByText(t.micPrivacyNote)).toBeDefined()
  })

  it("sets recognition lang to 'zh-CN' when clicking mic button in Chinese interface", () => {
    window.webkitSpeechRecognition = MockSpeechRecognition as unknown as typeof window.webkitSpeechRecognition
    render(<ChatPanel lang="zh" onOpenMap={() => {}} />)

    const micBtn = screen.getByRole('button', { name: t.micStart })
    fireEvent.click(micBtn)

    expect(MockSpeechRecognition.lastInstance).not.toBeNull()
    expect(MockSpeechRecognition.lastInstance?.lang).toBe('zh-CN')
    expect(MockSpeechRecognition.lastInstance?.interimResults).toBe(true)
    expect(MockSpeechRecognition.lastInstance?.start).toHaveBeenCalledTimes(1)
  })

  it('populates transcript into textarea when recognition result is received', async () => {
    window.webkitSpeechRecognition = MockSpeechRecognition as unknown as typeof window.webkitSpeechRecognition
    render(<ChatPanel lang="zh" onOpenMap={() => {}} />)

    const micBtn = screen.getByRole('button', { name: t.micStart })
    fireEvent.click(micBtn)

    const recognition = MockSpeechRecognition.lastInstance!
    expect(recognition).not.toBeNull()

    // 模拟语音识别结果返回
    recognition.onresult?.({
      resultIndex: 0,
      results: [
        [{ transcript: '发烧两天，咽痛头痛' }],
      ],
    } as unknown as SpeechRecognitionEvent)

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(t.inputPlaceholder) as HTMLTextAreaElement
      expect(textarea.value).toBe('发烧两天，咽痛头痛')
    })
  })

  it("displays permission denied notice when receiving 'not-allowed' error", async () => {
    window.webkitSpeechRecognition = MockSpeechRecognition as unknown as typeof window.webkitSpeechRecognition
    render(<ChatPanel lang="zh" onOpenMap={() => {}} />)

    const micBtn = screen.getByRole('button', { name: t.micStart })
    fireEvent.click(micBtn)

    const recognition = MockSpeechRecognition.lastInstance!
    expect(recognition).not.toBeNull()

    // 模拟权限被拒绝错误
    recognition.onerror?.({ error: 'not-allowed' })

    await waitFor(() => {
      expect(screen.getByText(t.micPermissionDenied)).toBeDefined()
    })
  })

  it('clears input upon sending message and ignores subsequent voice recognition results', async () => {
    window.webkitSpeechRecognition = MockSpeechRecognition as unknown as typeof window.webkitSpeechRecognition
    render(<ChatPanel lang="zh" onOpenMap={() => {}} />)

    const micBtn = screen.getByRole('button', { name: t.micStart })
    fireEvent.click(micBtn)

    const recognition = MockSpeechRecognition.lastInstance!
    expect(recognition).not.toBeNull()

    recognition.onresult?.({
      resultIndex: 0,
      results: [[{ transcript: '我昨天跌倒很痛怎么办' }]],
    } as unknown as SpeechRecognitionEvent)

    const textarea = screen.getByPlaceholderText(t.inputPlaceholder) as HTMLTextAreaElement
    await waitFor(() => {
      expect(textarea.value).toBe('我昨天跌倒很痛怎么办')
    })

    // 点击发送按钮
    const sendBtn = screen.getByRole('button', { name: t.sendAria })
    fireEvent.click(sendBtn)

    // 输入框已被清空
    expect(textarea.value).toBe('')

    // 模拟语音服务在发送之后触发延迟的 onresult 事件
    recognition.onresult?.({
      resultIndex: 0,
      results: [[{ transcript: '我昨天跌倒很痛怎么办' }]],
    } as unknown as SpeechRecognitionEvent)

    // 输入框仍然保持清空，不会被残留语音结果重新填充
    expect(textarea.value).toBe('')
  })
})
