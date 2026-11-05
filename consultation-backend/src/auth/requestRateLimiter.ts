// 按用户限制 AI 问诊请求频率，保护 Gemini 配额（滑动窗口，内存存储）
const DEFAULT_LIMIT_PER_MINUTE = 12
const WINDOW_MS = 60 * 1000

function readLimit() {
  const configured = Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE)
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_LIMIT_PER_MINUTE
}

export class RequestRateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit = readLimit(),
    private readonly windowMs = WINDOW_MS,
  ) {}

  /** 记录一次请求；若超出限制返回需要等待的秒数，否则返回 0 */
  consume(key: string, now = Date.now()) {
    const recent = (this.hits.get(key) ?? []).filter(
      (time) => now - time < this.windowMs,
    )

    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000))
    }

    recent.push(now)
    this.hits.set(key, recent)

    if (this.hits.size > 10_000) {
      for (const [entryKey, times] of this.hits) {
        if (times.every((time) => now - time >= this.windowMs)) {
          this.hits.delete(entryKey)
        }
      }
    }
    return 0
  }
}
