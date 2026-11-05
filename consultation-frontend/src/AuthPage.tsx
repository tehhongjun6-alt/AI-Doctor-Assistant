import { useState, type FormEvent } from 'react'
import { requestAuth, saveSession, type AuthSession } from './auth'
import type { Language } from './i18n'

type Mode = 'login' | 'register'

const text = {
  zh: {
    title: 'AI 医生助手',
    loginDesc: '登录账号，开始健康咨询',
    registerDesc: '创建新账号，只需邮箱和密码',
    login: '登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    passwordHint: '至少 8 个字符',
    submitLogin: '登录',
    submitRegister: '注册并进入',
    loading: '请稍候...',
    mismatch: '两次输入的密码不一致。',
    tooShort: '密码至少需要 8 个字符。',
    networkError: '无法连接服务器，请稍后再试。',
    switchToRegister: '还没有账号？',
    switchToLogin: '已经有账号？',
  },
  en: {
    title: 'AI Doctor Assistant',
    loginDesc: 'Sign in to start your health consultation',
    registerDesc: 'Create an account with just email and password',
    login: 'Sign in',
    register: 'Sign up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    passwordHint: 'At least 8 characters',
    submitLogin: 'Sign in',
    submitRegister: 'Create account',
    loading: 'Please wait...',
    mismatch: 'Passwords do not match.',
    tooShort: 'Password must be at least 8 characters.',
    networkError: 'Cannot reach the server. Please try again later.',
    switchToRegister: "Don't have an account?",
    switchToLogin: 'Already have an account?',
  },
}

interface AuthPageProps {
  lang: Language
  onChangeLang: (lang: Language) => void
  onAuthenticated: (session: AuthSession) => void
  notice?: string
}

export default function AuthPage({
  lang,
  onChangeLang,
  onAuthenticated,
  notice,
}: AuthPageProps) {
  const t = text[lang]
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  function switchMode(next: Mode) {
    setMode(next)
    setError(undefined)
    setPassword('')
    setConfirm('')
  }

  function fail(message: string) {
    setError(message)
    setShakeKey((key) => key + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    if (mode === 'register') {
      if (password.length < 8) return fail(t.tooShort)
      if (password !== confirm) return fail(t.mismatch)
    }

    setIsSubmitting(true)
    setError(undefined)
    try {
      const session = await requestAuth(mode, email.trim(), password)
      saveSession(session)
      onAuthenticated(session)
    } catch (requestError) {
      const message =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : t.networkError
      fail(message)
      setPassword('')
      setConfirm('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-gate-viewport">
      <div
        key={shakeKey}
        className={`login-gate-card ${shakeKey > 0 ? 'shake' : ''}`}
      >
        <div className="auth-lang-row">
          <div className="lang-switch-pill" role="group" aria-label="Language switch">
            <button
              type="button"
              className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
              onClick={() => onChangeLang('zh')}
            >
              中文
            </button>
            <button
              type="button"
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => onChangeLang('en')}
            >
              EN
            </button>
          </div>
        </div>

        <div className="login-avatar-circle" aria-hidden="true" />
        <h1 className="login-gate-title">{t.title}</h1>
        <p className="login-gate-desc">
          {mode === 'login' ? t.loginDesc : t.registerDesc}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            {t.login}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            {t.register}
          </button>
        </div>

        {notice && !error && (
          <div className="auth-notice" role="status">
            {notice}
          </div>
        )}

        <form className="login-gate-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>{t.email}</span>
            <input
              type="email"
              className="login-gate-input auth-input"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="auth-field">
            <span>{t.password}</span>
            <input
              type="password"
              className="login-gate-input auth-input"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? t.passwordHint : ''}
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {mode === 'register' && (
            <label className="auth-field">
              <span>{t.confirmPassword}</span>
              <input
                type="password"
                className="login-gate-input auth-input"
                autoComplete="new-password"
                value={confirm}
                required
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}

          {error && (
            <div className="login-gate-error-text" role="alert">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="login-gate-btn"
            disabled={isSubmitting || !email.trim() || !password}
          >
            {isSubmitting
              ? t.loading
              : mode === 'login'
                ? t.submitLogin
                : t.submitRegister}
          </button>
        </form>

        <div className="login-gate-hint">
          {mode === 'login' ? t.switchToRegister : t.switchToLogin}{' '}
          <button
            type="button"
            className="auth-link-btn"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? t.register : t.login}
          </button>
        </div>
      </div>
    </div>
  )
}
