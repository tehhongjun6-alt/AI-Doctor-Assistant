// 登录失败次数限制：同一 IP + 邮箱在 15 分钟内失败 5 次后锁定 15 分钟
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

interface Entry {
  failures: number
  firstFailureAt: number
  lockedUntil: number
}

export class LoginRateLimiter {
  private readonly entries = new Map<string, Entry>()

  constructor(
    private readonly maxFailures = MAX_FAILURES,
    private readonly windowMs = WINDOW_MS,
  ) {}

  private cleanup(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil < now && now - entry.firstFailureAt > this.windowMs) {
        this.entries.delete(key)
      }
    }
  }

  /** 返回剩余锁定秒数；0 表示可以尝试登录 */
  retryAfterSeconds(key: string, now = Date.now()) {
    const entry = this.entries.get(key)
    if (!entry || entry.lockedUntil <= now) return 0
    return Math.ceil((entry.lockedUntil - now) / 1000)
  }

  recordFailure(key: string, now = Date.now()) {
    this.cleanup(now)
    const existing = this.entries.get(key)
    const entry =
      existing && now - existing.firstFailureAt <= this.windowMs
        ? existing
        : { failures: 0, firstFailureAt: now, lockedUntil: 0 }
    entry.failures += 1
    if (entry.failures >= this.maxFailures) {
      entry.lockedUntil = now + this.windowMs
    }
    this.entries.set(key, entry)
  }

  reset(key: string) {
    this.entries.delete(key)
  }
}
