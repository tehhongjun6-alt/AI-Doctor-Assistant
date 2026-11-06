import { useState, type FormEvent } from 'react'
import { requestAuth, saveSession, type AuthSession } from '../auth'
import { Icon } from '../components/Icon'
import { LangToggle } from '../components/LangToggle'
import { Logo } from '../components/Logo'
import type { Language } from '../i18n'
import './auth.css'

type Mode = 'login' | 'register'

const text = {
  zh: {
    loginTitle: '欢迎回来',
    registerTitle: '创建 Medora 账号',
    loginDesc: '登录后继续你的健康咨询。',
    registerDesc: '只需要邮箱和密码。',
    login: '登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    passwordHint: '至少 8 个字符',
    submitLogin: '登录',
    submitRegister: '注册并进入',
    loading: '请稍候…',
    mismatch: '两次输入的密码不一致。',
    tooShort: '密码至少需要 8 个字符。',
    networkError: '无法连接服务器，请稍后再试。',
    switchToRegister: '还没有账号？',
    switchToLogin: '已经有账号？',
    back: '返回首页',
    side: '健康这件事，一起面对。',
    sideNote: 'Medora 是 AI 健康助手，不能替代医生诊断。紧急情况请拨打 999。',
  },
  en: {
    loginTitle: 'Welcome back',
    registerTitle: 'Create your Medora account',
    loginDesc: 'Sign in to continue your health conversations.',
    registerDesc: 'All you need is an email and a password.',
    login: 'Sign in',
    register: 'Sign up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    passwordHint: 'At least 8 characters',
    submitLogin: 'Sign in',
    submitRegister: 'Create account',
    loading: 'Please wait…',
    mismatch: 'Passwords do not match.',
    tooShort: 'Password must be at least 8 characters.',
    networkError: 'Cannot reach the server. Please try again later.',
    switchToRegister: "Don't have an account?",
    switchToLogin: 'Already have an account?',
    back: 'Back to home',
    side: 'Your health, together.',
    sideNote: "Medora is an AI health assistant and can't replace a doctor. In an emergency, call 999.",
  },
  ms: {
    loginTitle: 'Selamat kembali',
    registerTitle: 'Cipta akaun Medora anda',
    loginDesc: 'Log masuk untuk meneruskan konsultasi kesihatan anda.',
    registerDesc: 'Hanya perlukan e-mel dan kata laluan.',
    login: 'Log masuk',
    register: 'Daftar',
    email: 'E-mel',
    password: 'Kata laluan',
    confirmPassword: 'Sahkan kata laluan',
    passwordHint: 'Sekurang-kurangnya 8 aksara',
    submitLogin: 'Log masuk',
    submitRegister: 'Daftar dan masuk',
    loading: 'Sila tunggu…',
    mismatch: 'Kata laluan yang dimasukkan tidak sepadan.',
    tooShort: 'Kata laluan mesti sekurang-kurangnya 8 aksara.',
    networkError: 'Tidak dapat menyambung ke pelayan, sila cuba lagi sebentar nanti.',
    switchToRegister: 'Belum mempunyai akaun?',
    switchToLogin: 'Sudah mempunyai akaun?',
    back: 'Kembali ke laman utama',
    side: 'Kesihatan anda, kita hadapi bersama.',
    sideNote: 'Medora ialah pembantu kesihatan AI dan tidak menggantikan diagnosis doktor. Dalam situasi kecemasan, hubungi 999.',
  },
}

interface AuthPageProps {
  lang: Language
  onChangeLang: (lang: Language) => void
  onAuthenticated: (session: AuthSession) => void
  onBack?: () => void
  initialMode?: Mode
  notice?: string
}

export default function AuthPage({ lang, onChangeLang, onAuthenticated, onBack, initialMode = 'login', notice }: AuthPageProps) {
  const t = text[lang]
  const [mode, setMode] = useState<Mode>(initialMode)
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
    setShakeKey((k) => k + 1)
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
      fail(requestError instanceof Error && requestError.message ? requestError.message : t.networkError)
      setPassword('')
      setConfirm('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-side" aria-hidden="true">
        {/* 背景装饰：取自 Logo 折叠丝带的半透明大色带 */}
        <svg className="auth-ribbons" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
          <path d="M-60 860 L 120 120 Q 140 60 190 100 L 330 300" />
          <path className="is-light" d="M150 90 L 420 470 Q 450 510 480 460 L 640 140" />
          <path d="M470 900 L 560 520" />
        </svg>
        <div className="auth-brand">
          <span className="auth-logo-card">
            <Logo height={46} />
          </span>
          <p className="auth-tagline">{t.side}</p>
        </div>
      </div>

      <main className="auth-main">
        <div className="auth-top">
          {onBack ? (
            <button type="button" className="btn btn-ghost btn-sm auth-back" onClick={onBack}>
              <Icon name="arrowRight" size={16} style={{ transform: 'rotate(180deg)' }} />
              {t.back}
            </button>
          ) : (
            <span />
          )}
          <LangToggle lang={lang} onChange={onChangeLang} />
        </div>

        <div key={shakeKey} className={`auth-card ${shakeKey > 0 ? 'is-shake' : ''}`}>
          <span className="auth-card-logo">
            <Logo height={26} />
          </span>
          <h1 className="auth-title">{mode === 'login' ? t.loginTitle : t.registerTitle}</h1>
          <p className="auth-desc">{mode === 'login' ? t.loginDesc : t.registerDesc}</p>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab ${mode === 'login' ? 'is-active' : ''}`}
              onClick={() => switchMode('login')}
            >
              {t.login}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`auth-tab ${mode === 'register' ? 'is-active' : ''}`}
              onClick={() => switchMode('register')}
            >
              {t.register}
            </button>
          </div>

          {notice && !error && (
            <div className="auth-notice" role="status">
              <Icon name="info" size={17} />
              <span>{notice}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>{t.email}</span>
              <input
                type="email"
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
                  autoComplete="new-password"
                  value={confirm}
                  required
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            )}

            {error && (
              <div className="auth-error" role="alert">
                <Icon name="alert" size={17} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting || !email.trim() || !password}>
              {isSubmitting && <span className="spinner auth-spinner" aria-hidden="true" />}
              {isSubmitting ? t.loading : mode === 'login' ? t.submitLogin : t.submitRegister}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? t.switchToRegister : t.switchToLogin}{' '}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? t.register : t.login}
            </button>
          </p>

          <p className="auth-footnote">{t.sideNote}</p>
        </div>
      </main>
    </div>
  )
}
