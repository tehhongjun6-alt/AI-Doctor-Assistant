import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatToolbar } from './ChatToolbar'
import { translations } from '../i18n'
import * as summaryService from '../services/visitSummaryService'

vi.mock('../services/visitSummaryService', () => ({
  requestVisitSummary: vi.fn(),
}))

describe('visitSummary frontend (Step 8)', () => {
  const requestVisitSummaryMock = vi.mocked(summaryService.requestVisitSummary)
  const t = translations.zh
  const writeTextMock = vi.fn().mockResolvedValue(undefined)
  const printMock = vi.fn()

  const sampleSummary: summaryService.CaseSummary = {
    chiefComplaint: '发烧两天，喉咙痛',
    duration: '2 天',
    symptoms: ['体温 38.5 度', '咽喉吞咽疼痛'],
    medications: ['对乙酰氨基酚'],
    allergies: [], // 空数组，应不渲染
    relevantHistory: ['既往健康'],
    aiAssessment: ['初步考虑上呼吸道病毒感染可能'],
    redFlags: ['呼吸困难', '体温持续高于 39 度'],
    questionsForDoctor: ['是否需要进行流感或新冠抗原检测？'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
    window.print = printMock
  })

  afterEach(() => {
    cleanup()
  })

  it('disables visit summary button when canSummarize is false', () => {
    render(
      <ChatToolbar
        t={t}
        conversations={[{ id: 'conv-1', title: '发烧咨询', messageCount: 0, updatedAt: '' }]}
        limit={3}
        activeId="conv-1"
        canSummarize={false}
        lang="zh"
        onSelect={() => {}}
        onDelete={() => {}}
        onNew={() => {}}
        onOpenMenu={() => {}}
      />
    )

    const summaryBtn = screen.getByRole('button', { name: new RegExp(t.visitSummary) })
    expect((summaryBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking visit summary button calls requestVisitSummary and displays chiefComplaint and AI disclaimer', async () => {
    requestVisitSummaryMock.mockResolvedValueOnce({
      ok: true,
      summary: sampleSummary,
      generatedAt: '2026-11-06T10:00:00.000Z',
    })

    render(
      <ChatToolbar
        t={t}
        conversations={[{ id: 'conv-1', title: '发烧咨询', messageCount: 2, updatedAt: '' }]}
        limit={3}
        activeId="conv-1"
        canSummarize={true}
        lang="zh"
        onSelect={() => {}}
        onDelete={() => {}}
        onNew={() => {}}
        onOpenMenu={() => {}}
      />
    )

    const summaryBtn = screen.getByRole('button', { name: new RegExp(t.visitSummary) })
    expect((summaryBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(summaryBtn)

    expect(requestVisitSummaryMock).toHaveBeenCalledWith('conv-1', 'zh')

    // 等待摘要弹窗渲染并显示 chiefComplaint 和 AI 免责提示
    await waitFor(() => {
      expect(screen.getByText('发烧两天，喉咙痛')).toBeDefined()
    })

    expect(screen.getByText(t.visitSummaryDisclaimer)).toBeDefined()
    expect(screen.getByText('体温 38.5 度')).toBeDefined()
    expect(screen.getByText('对乙酰氨基酚')).toBeDefined()
    expect(screen.getByText('呼吸困难')).toBeDefined()

    // allergies 为空，不应渲染过敏史标题
    expect(screen.queryByText(t.allergiesTitle)).toBeNull()

    // 复制功能测试
    const copyBtn = screen.getByRole('button', { name: new RegExp(t.copySummary) })
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1)
    })
    const copiedText = writeTextMock.mock.calls[0][0] as string
    expect(copiedText).toContain('发烧两天，喉咙痛')
    expect(copiedText).toContain(t.visitSummaryTitle)
    expect(copiedText).toContain(t.visitSummaryDisclaimer)

    // 打印功能测试
    const printBtn = screen.getByRole('button', { name: new RegExp(t.printSummary) })
    fireEvent.click(printBtn)
    expect(printMock).toHaveBeenCalledTimes(1)

    // 关闭弹窗测试
    const closeBtns = screen.getAllByRole('button', { name: new RegExp(t.closeSummary) })
    expect(closeBtns.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(closeBtns[0])
    await waitFor(() => {
      expect(screen.queryByText('发烧两天，喉咙痛')).toBeNull()
    })
  })

  it('displays error message when requestVisitSummary fails', async () => {
    requestVisitSummaryMock.mockResolvedValueOnce({
      ok: false,
      error: { code: 'AI_MODEL_UNAVAILABLE', message: 'AI 服务暂时无法使用' },
    })

    render(
      <ChatToolbar
        t={t}
        conversations={[{ id: 'conv-1', title: '发烧咨询', messageCount: 2, updatedAt: '' }]}
        limit={3}
        activeId="conv-1"
        canSummarize={true}
        lang="zh"
        onSelect={() => {}}
        onDelete={() => {}}
        onNew={() => {}}
        onOpenMenu={() => {}}
      />
    )

    const summaryBtn = screen.getByRole('button', { name: new RegExp(t.visitSummary) })
    fireEvent.click(summaryBtn)

    await waitFor(() => {
      expect(screen.getByText('AI 服务暂时无法使用')).toBeDefined()
    })
  })
})
