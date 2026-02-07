import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function LoginPage() {
  const { profile, selectProfile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .then(({ data }) => {
        setProfiles(data || [])
        setLoading(false)
      })
  }, [])

  if (profile) return <Navigate to="/" replace />

  const handleSelect = async (id) => {
    await selectProfile(id)
    navigate('/')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: insertErr } = await supabase
      .from('profiles')
      .insert({ display_name: name.trim() })
      .select()
      .single()

    if (insertErr) {
      setError(insertErr.message)
      setSubmitting(false)
      return
    }

    await selectProfile(data.id)
    navigate('/onboarding')
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
          <p className="text-sm text-gray-500">{t('login.whoIsIt')}</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
        )}

        {loading ? (
          <p className="text-center text-gray-400">{t('login.loading')}</p>
        ) : (
          <>
            {profiles.length > 0 && (
              <div className="space-y-3">
                {profiles.map((p) => {
                  const initial = p.display_name?.charAt(0)?.toUpperCase() || '?'
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelect(p.id)}
                      className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-orange-400 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
                        {initial}
                      </div>
                      <span className="text-lg font-semibold text-gray-900">{p.display_name}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {!showCreate && profiles.length < 2 && (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors cursor-pointer font-medium"
              >
                {t('login.createProfile')}
              </button>
            )}

            {showCreate && (
              <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('login.firstName')}
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder={t('login.firstNamePlaceholder')}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? t('login.creating') : t('login.create')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  {t('login.cancel')}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
