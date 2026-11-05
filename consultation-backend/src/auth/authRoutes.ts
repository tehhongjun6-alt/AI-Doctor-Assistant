import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { hashPassword, verifyPassword } from './password.js'
import { LoginRateLimiter } from './loginRateLimiter.js'
import { signToken, verifyToken, type TokenPayload } from './token.js'
import {
  DatabaseNotConfiguredError,
  EmailTakenError,
  type UserRepository,
} from './userRepository.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload
}

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  response.status(status).json({ success: false, error: { code, message } })
}

function readCredentials(body: unknown) {
  const { email, password } = (body ?? {}) as Record<string, unknown>
  if (typeof email !== 'string' || typeof password !== 'string') return null
  return { email: email.trim().toLowerCase(), password }
}

function handleServerError(response: Response, error: unknown) {
  if (error instanceof DatabaseNotConfiguredError) {
    sendError(response, 503, 'DATABASE_NOT_CONFIGURED', '数据库尚未配置。')
    return
  }
  console.error('Auth request failed', error)
  sendError(response, 500, 'AUTH_SERVER_ERROR', '服务器暂时无法处理，请稍后再试。')
}

/** 保护接口：要求请求头带 Authorization: Bearer <token> */
export function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const header = request.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  let payload: TokenPayload | null = null
  try {
    payload = token ? verifyToken(token) : null
  } catch (error) {
    handleServerError(response, error)
    return
  }
  if (!payload) {
    sendError(response, 401, 'UNAUTHORIZED', '登录已过期，请重新登录。')
    return
  }
  request.user = payload
  next()
}

export function createAuthRouter(
  users: UserRepository,
  limiter = new LoginRateLimiter(),
) {
  const router = express.Router()

  router.post('/register', async (request, response) => {
    const credentials = readCredentials(request.body)
    if (!credentials || !EMAIL_PATTERN.test(credentials.email) || credentials.email.length > 254) {
      sendError(response, 400, 'INVALID_EMAIL', '请输入有效的邮箱地址。')
      return
    }
    if (
      credentials.password.length < MIN_PASSWORD_LENGTH ||
      credentials.password.length > MAX_PASSWORD_LENGTH
    ) {
      sendError(response, 400, 'WEAK_PASSWORD', `密码长度需为 ${MIN_PASSWORD_LENGTH} 至 ${MAX_PASSWORD_LENGTH} 个字符。`)
      return
    }

    try {
      const user = await users.create({
        email: credentials.email,
        passwordHash: await hashPassword(credentials.password),
      })
      const session = signToken(user)
      response.status(201).json({
        success: true,
        data: { ...session, user: { id: user.id, email: user.email } },
      })
    } catch (error) {
      if (error instanceof EmailTakenError) {
        sendError(response, 409, 'EMAIL_TAKEN', '该邮箱已被注册，请直接登录。')
        return
      }
      handleServerError(response, error)
    }
  })

  router.post('/login', async (request, response) => {
    const credentials = readCredentials(request.body)
    if (!credentials) {
      sendError(response, 400, 'INVALID_CREDENTIALS', '请输入邮箱和密码。')
      return
    }

    const limitKey = `${request.ip}|${credentials.email}`
    const retryAfter = limiter.retryAfterSeconds(limitKey)
    if (retryAfter > 0) {
      response.setHeader('Retry-After', String(retryAfter))
      sendError(
        response,
        429,
        'TOO_MANY_ATTEMPTS',
        `登录失败次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后再试。`,
      )
      return
    }

    try {
      const user = await users.findByEmail(credentials.email)
      const valid = user
        ? await verifyPassword(credentials.password, user.passwordHash)
        : false

      if (!user || !valid) {
        limiter.recordFailure(limitKey)
        sendError(response, 401, 'WRONG_CREDENTIALS', '邮箱或密码错误。')
        return
      }

      limiter.reset(limitKey)
      await users.recordLogin(user.id).catch(() => undefined)
      const session = signToken(user)
      response.json({
        success: true,
        data: { ...session, user: { id: user.id, email: user.email } },
      })
    } catch (error) {
      handleServerError(response, error)
    }
  })

  router.get('/me', requireAuth, (request: AuthenticatedRequest, response) => {
    response.json({
      success: true,
      data: { user: { id: request.user!.sub, email: request.user!.email } },
    })
  })

  return router
}
