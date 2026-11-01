import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('consultation shell', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends a message and displays the structured AI answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
          sources: [],
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByRole('textbox', { name: '消息' })
    const sendButton = screen.getByRole('button', { name: '发送' })

    expect((input as HTMLInputElement).disabled).toBe(false)
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)

    await user.type(input, '我的喉咙痛了两天。')
    await user.click(sendButton)

    expect(await screen.findByText('你描述了持续两天的喉咙痛。')).toBeTruthy()
    expect(screen.getByText('休息并补充水分。')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('shows an error and allows retrying the same message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: 'AI 服务暂时无法使用。' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox', { name: '消息' }), '我头痛。')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('AI 服务暂时无法使用。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
  })

  it('explains that the map key needs to be configured', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', '')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '地图' }))

    expect(screen.getByText('地图尚未配置')).toBeTruthy()
    expect(screen.getByText('请先加入 Geoapify API Key。')).toBeTruthy()
  })

  it('shows a clear message when location permission is denied', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback,
        ) => error({ code: 1, message: 'denied' } as GeolocationPositionError),
      },
    })

    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '地图' }))

    expect(
      await screen.findByText('无法获取你的位置，请允许浏览器使用定位。'),
    ).toBeTruthy()
  })
})
