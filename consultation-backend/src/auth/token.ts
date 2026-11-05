import { createHmac, timingSafeEqual } from 'node:crypto'

// 轻量 JWT（HS256）签发与验证，使用环境变量 JWT_SECRET
export interface TokenPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60 // 默认 24 小时

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET 未配置或长度不足 32 个字符。')
  }
  return secret
}

function getTtlSeconds() {
  const configured = Number(process.env.JWT_TTL_SECONDS)
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TTL_SECONDS
}

function sign(data: string) {
  return createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function signToken(user: { id: string; email: string }) {
  const now = Math.floor(Date.now() / 1000)
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + getTtlSeconds(),
  }
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  return {
    token: `${header}.${body}.${sign(`${header}.${body}`)}`,
    expiresAt: payload.exp * 1000,
  }
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts

  const expected = Buffer.from(sign(`${header}.${body}`))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as TokenPayload
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= Date.now()
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
