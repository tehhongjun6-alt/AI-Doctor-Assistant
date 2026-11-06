import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AssistantMessage, type ChatMessage } from './AssistantMessage'
import { translations } from '../i18n'

describe('sources provider labels (Step 5)', () => {
  const t = translations.zh

  afterEach(() => {
    cleanup()
  })

  it("displays 'NHS' when source has provider: 'nhs'", () => {
    const messageWithProvider: ChatMessage = {
      id: 'msg-nhs',
      role: 'assistant',
      content: '小结内容',
      sources: [
        {
          title: 'Cough Advice',
          url: 'https://www.nhs.uk/conditions/cough/',
          provider: 'nhs',
        },
      ],
    }

    render(
      <AssistantMessage
        message={messageWithProvider}
        t={t}
        displayContent={messageWithProvider.content}
        onOpenMap={() => {}}
      />,
    )

    expect(screen.getByText('NHS')).toBeDefined()
    expect(screen.getByText('Cough Advice')).toBeDefined()
  })

  it('renders sources without provider normally without errors or label', () => {
    const messageWithoutProvider: ChatMessage = {
      id: 'msg-old',
      role: 'assistant',
      content: '旧消息内容',
      sources: [
        {
          title: 'Old Source Article',
          url: 'https://example.com/health',
        },
      ],
    }

    render(
      <AssistantMessage
        message={messageWithoutProvider}
        t={t}
        displayContent={messageWithoutProvider.content}
        onOpenMap={() => {}}
      />,
    )

    expect(screen.getByText('Old Source Article')).toBeDefined()
    expect(screen.queryByText('NHS')).toBeNull()
    expect(screen.queryByText('MedlinePlus')).toBeNull()
  })

  it('maps known providers correctly (medlineplus, openfda, rxnorm, kkmnow, icd11)', () => {
    const messageMultiple: ChatMessage = {
      id: 'msg-all',
      role: 'assistant',
      content: '综合参考资料',
      sources: [
        { title: 'Medline Doc', url: 'https://medline.gov', provider: 'medlineplus' },
        { title: 'FDA Drug', url: 'https://fda.gov', provider: 'openfda' },
        { title: 'Rx Norm', url: 'https://nlm.nih.gov', provider: 'rxnorm' },
        { title: 'KKM Data', url: 'https://data.moh.gov.my', provider: 'kkmnow' },
        { title: 'WHO Guide', url: 'https://who.int', provider: 'icd11' },
      ],
    }

    render(
      <AssistantMessage
        message={messageMultiple}
        t={t}
        displayContent={messageMultiple.content}
        onOpenMap={() => {}}
      />,
    )

    expect(screen.getByText('MedlinePlus')).toBeDefined()
    expect(screen.getByText('OpenFDA')).toBeDefined()
    expect(screen.getByText('RxNorm')).toBeDefined()
    expect(screen.getByText('KKMNow')).toBeDefined()
    expect(screen.getByText('WHO ICD-11')).toBeDefined()
  })
})
