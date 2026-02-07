import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function ProtectedRoute({ children }) {
  const { profile, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />

  if (!profile?.household_id) return <Navigate to="/onboarding" replace />

  return children
}
