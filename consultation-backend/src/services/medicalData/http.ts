export class MedicalHttpError extends Error {
  constructor(
    public readonly code:
      | 'NOT_CONFIGURED'
      | 'TIMEOUT'
      | 'API_ERROR'
      | 'INVALID_RESPONSE',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'MedicalHttpError'
  }
}

export function getMedicalApiTimeout() {
  const configured = Number(process.env.MEDICAL_API_TIMEOUT_MS ?? 8000)
  return Number.isFinite(configured) && configured > 0 ? configured : 8000
}

export async function fetchMedicalResource(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(getMedicalApiTimeout()),
    })

    if (!response.ok) {
      throw new MedicalHttpError(
        'API_ERROR',
        `医学资料服务返回 HTTP ${response.status}。`,
      )
    }

    return response
  } catch (error) {
    if (error instanceof MedicalHttpError) {
      throw error
    }

    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new MedicalHttpError('TIMEOUT', '医学资料服务请求超时。', {
        cause: error,
      })
    }

    throw new MedicalHttpError('API_ERROR', '无法连接医学资料服务。', {
      cause: error,
    })
  }
}

export function stripMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

