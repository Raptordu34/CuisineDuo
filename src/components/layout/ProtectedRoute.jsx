import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    console.log('[ProtectedRoute] loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (!user) {
    console.log('[ProtectedRoute] no user → redirect /login')
    return <Navigate to="/login" replace />
  }

  if (!profile?.household_id) {
    console.log('[ProtectedRoute] no household_id (profile=', profile, ') → redirect /onboarding')
    return <Navigate to="/onboarding" replace />
  }

  console.log('[ProtectedRoute] OK user=', user.id, 'profile=', profile.id)
  return children
}
