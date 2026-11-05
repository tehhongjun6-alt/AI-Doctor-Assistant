// 登录状态管理：令牌保存在浏览器 localStorage，请求时自动附带
export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  (import.meta.env.DEV
    ? 'http://127.0.0.1:8002'
    : 'https://ai-doctor-assistant-79tt.onrender.com')

const SESSION_KEY = 'ai_doc_auth_session'
export const AUTH_EXPIRED_EVENT = 'ai-doc:auth-expired'

export interface AuthSession {
  token: string
  expiresAt: number
  user: { id: string; email: string }
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AuthSession
    if (!session.token || Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
}

export function saveSession(session: AuthSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* 隐私模式下无法保存，仅本次页面有效 */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** 带登录令牌的 fetch；后端返回 401 时自动通知 App 退回登录页 */
export async function authFetch(path: string, init: RequestInit = {}) {
  const session = loadSession()
  const headers = new Headers(init.headers)
  if (session) headers.set('Authorization', `Bearer ${session.token}`)

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers })
  if (response.status === 401) {
    clearSession()
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }
  return response
}

/** 调用注册或登录接口 */
export async function requestAuth(
  mode: 'login' | 'register',
  email: string,
  password: string,
): Promise<AuthSession> {
  const response = await fetch(`${apiBaseUrl}/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const result = (await response.json().catch(() => ({}))) as {
    success?: boolean
    data?: AuthSession
    error?: { message?: string }
  }
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? '')
  }
  return result.data
}
