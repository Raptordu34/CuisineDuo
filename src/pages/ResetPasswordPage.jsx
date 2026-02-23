import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

export default function ResetPasswordPage() {
  const { passwordRecovery, updatePassword } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Si on arrive ici sans token de recuperation, retour au login
  if (!passwordRecovery) return <Navigate to="/login" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError(t('login.passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('login.passwordMismatch'))
      return
    }

    setSubmitting(true)
    const { error: updateError } = await updatePassword(password)
    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    // updatePassword a charge le profil — naviguer vers l'app
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src="/icons/icon-192.png" alt="CuisineDuo" className="w-20 h-20 mx-auto" />
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{t('login.newPasswordTitle')}</h1>
          <p className="text-sm text-gray-500">{t('login.newPasswordSubtitle')}</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t('login.newPassword')}
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder={t('login.newPasswordPlaceholder')}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t('login.confirmNewPassword')}
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder={t('login.newPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? t('login.updatingPassword') : t('login.updatePassword')}
          </button>
        </form>
      </div>
    </div>
  )
}
