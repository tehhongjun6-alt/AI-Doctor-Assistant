import { useState, type FormEvent } from 'react'
import { authFetch, clearSession } from '../auth'
import { Icon } from '../components/Icon'
import type { Translation } from '../i18n'

interface DeleteAccountDialogProps {
  t: Translation
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DeleteAccountDialog({
  t,
  isOpen,
  onClose,
  onSuccess,
}: DeleteAccountDialogProps) {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  if (!isOpen) return null

  function handleClose() {
    if (isSubmitting) return
    setPassword('')
    setError(undefined)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError(undefined)

    try {
      const res = await authFetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.status === 204) {
        clearSession()
        onSuccess()
        return
      }

      if (res.status === 401) {
        setError(t.wrongPassword)
        return
      }

      if (res.status === 429) {
        setError(t.tooManyAttempts)
        return
      }

      const data = await res.json().catch(() => null)
      setError(data?.error?.message ?? t.errorDefault)
    } catch {
      setError(t.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="delete-dialog-overlay"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="delete-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-dialog-header">
          <div className="delete-dialog-icon" aria-hidden="true">
            <Icon name="alert" size={20} strokeWidth={2.2} />
          </div>
          <h2 id="delete-account-title" className="delete-dialog-title">
            {t.deleteAccountDialogTitle}
          </h2>
        </div>

        <p className="delete-dialog-warning">{t.deleteAccountWarning}</p>

        <form onSubmit={handleSubmit} className="delete-dialog-form">
          <div className="delete-dialog-field">
            <input
              id="delete-account-password"
              type="password"
              className="delete-dialog-input"
              placeholder={t.deleteAccountPasswordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {error && (
            <div className="delete-dialog-error" role="alert">
              <Icon name="info" size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="delete-dialog-actions">
            <button
              type="button"
              className="delete-dialog-btn delete-dialog-btn-cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="delete-dialog-btn delete-dialog-btn-danger"
              disabled={!password.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <span className="spinner" aria-hidden="true" />
              ) : null}
              <span>{t.deleteAccountConfirmBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
