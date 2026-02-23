import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function LoginPage() {
  const { profile, loading, signIn, signUp, resetPassword } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signIn') // 'signIn' | 'signUp' | 'resetPassword'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Detecter les erreurs Supabase dans le hash (ex: lien expire)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const errorCode = params.get('error_code')
      if (errorCode === 'otp_expired') {
        setError(t('login.linkExpired'))
        setMode('resetPassword')
      } else {
        const desc = params.get('error_description')
        if (desc) setError(decodeURIComponent(desc.replace(/\+/g, ' ')))
      }
      // Nettoyer le hash
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [t])

  if (profile) return <Navigate to="/" replace />

  // Afficher un loader pendant la restauration de session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    console.log('[Login] handleSignIn start email=', email)
    const { error: signInError } = await signIn(email, password)
    console.log('[Login] signIn returned error=', signInError?.message ?? 'null')
    if (signInError) {
      setError(t('login.invalidCredentials'))
      setSubmitting(false)
      return
    }

    // Ne pas naviguer manuellement : onAuthStateChange va charger le profil,
    // ce qui declenche le guard "if (profile) return <Navigate to="/" />" ci-dessus
    console.log('[Login] signIn success, waiting for profile...')
  }

  const handleSignUp = async (e) => {
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

    const { error: signUpError } = await signUp(email, password, displayName.trim())
    if (signUpError) {
      if (signUpError.message?.includes('already registered')) {
        setError(t('login.emailInUse'))
      } else {
        setError(signUpError.message)
      }
      setSubmitting(false)
      return
    }

    navigate('/onboarding')
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const { error: resetError } = await resetPassword(email)
    if (resetError) {
      setError(resetError.message)
      setSubmitting(false)
      return
    }

    setSuccess(t('login.resetSent'))
    setSubmitting(false)
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>

        <div className="text-center">
          <img src="/icons/icon-192.png" alt="CuisineDuo" className="w-20 h-20 mx-auto" />
          <h1 className="mt-2 text-2xl font-bold text-gray-900">CuisineDuo</h1>
          <p className="text-sm text-gray-500">
            {mode === 'signIn' && t('login.signInSubtitle')}
            {mode === 'signUp' && t('login.signUpSubtitle')}
            {mode === 'resetPassword' && t('login.resetPasswordSubtitle')}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600 bg-green-50 rounded-lg p-3">{success}</p>
        )}

        {mode === 'signIn' && (
          <form onSubmit={handleSignIn} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.password')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('login.signingIn') : t('login.signIn')}
            </button>
            <div className="text-center text-sm text-gray-500 space-y-1">
              <p>
                <button type="button" onClick={() => switchMode('resetPassword')} className="text-orange-500 font-medium hover:text-orange-600 cursor-pointer">
                  {t('login.forgotPassword')}
                </button>
              </p>
              <p>
                {t('login.noAccount')}{' '}
                <button type="button" onClick={() => switchMode('signUp')} className="text-orange-500 font-medium hover:text-orange-600 cursor-pointer">
                  {t('login.signUp')}
                </button>
              </p>
            </div>
          </form>
        )}

        {mode === 'signUp' && (
          <form onSubmit={handleSignUp} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.displayName')}
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('login.displayNamePlaceholder')}
                autoComplete="name"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="signupEmail" className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.email')}
              </label>
              <input
                id="signupEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="signupPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.password')}
              </label>
              <input
                id="signupPassword"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('login.confirmPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('login.signingUp') : t('login.signUp')}
            </button>
            <p className="text-center text-sm text-gray-500">
              {t('login.hasAccount')}{' '}
              <button type="button" onClick={() => switchMode('signIn')} className="text-orange-500 font-medium hover:text-orange-600 cursor-pointer">
                {t('login.signIn')}
              </button>
            </p>
          </form>
        )}

        {mode === 'resetPassword' && (
          <form onSubmit={handleResetPassword} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.email')}
              </label>
              <input
                id="resetEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('login.sendingResetLink') : t('login.sendResetLink')}
            </button>
            <p className="text-center text-sm text-gray-500">
              <button type="button" onClick={() => switchMode('signIn')} className="text-orange-500 font-medium hover:text-orange-600 cursor-pointer">
                {t('login.backToSignIn')}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
