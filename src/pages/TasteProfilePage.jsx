import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTasteProfile } from '../hooks/useTasteProfile'
import TasteProfileDisplay from '../components/recipes/TasteProfileDisplay'
import TasteParamSliders from '../components/recipes/TasteParamSliders'

const TASTE_KEYS = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']

const emptyOverrides = () => {
  const o = {}
  TASTE_KEYS.forEach((k) => (o[k] = null))
  return o
}

export default function TasteProfilePage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { userTasteProfile, householdTasteProfiles, ratingsCount, loading, refetch } = useTasteProfile(
    profile?.id,
    profile?.household_id
  )

  const [overrides, setOverrides] = useState(emptyOverrides())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(true)

  // Fetch existing preferences
  const fetchPrefs = useCallback(async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('taste_preferences')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle()
      if (data) {
        const o = {}
        TASTE_KEYS.forEach((k) => (o[k] = data[k] ?? null))
        setOverrides(o)
        setNotes(data.notes || '')
      }
    } catch {
      // Table may not exist or no row yet
    } finally {
      setPrefsLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs])

  const handleSave = async () => {
    if (!profile?.id) return
    setSaving(true)
    try {
      await supabase.from('taste_preferences').upsert(
        {
          profile_id: profile.id,
          ...overrides,
          notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  if (loading || prefsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-2xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t('profile.title')}</h1>
              <p className="text-sm text-gray-500">{profile?.display_name}</p>
            </div>
          </div>

          {/* Calculated taste profile */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-0.5">{t('profile.tastePreferences')}</h2>
            <p className="text-xs text-gray-400 mb-3">{t('profile.tastePreferencesDesc')}</p>
            {ratingsCount > 0 ? (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  {t('profile.calculatedFrom', { count: ratingsCount })}
                </p>
                {userTasteProfile && Object.values(userTasteProfile).some((v) => v != null) ? (
                  <TasteProfileDisplay profile={userTasteProfile} mode="user" />
                ) : (
                  <p className="text-sm text-gray-400 bg-amber-50 rounded-lg px-3 py-2">{t('profile.noTasteData')}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-2">{t('profile.noRatings')}</p>
            )}
          </section>

          {/* Manual preferences */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-0.5">{t('profile.manualOverride')}</h2>
            <p className="text-xs text-gray-400 mb-3">{t('profile.manualOverrideDesc')}</p>
            <TasteParamSliders values={overrides} onChange={setOverrides} />
          </section>

          {/* Personal notes */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('profile.notes')}</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('profile.notesPlaceholder')}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 resize-none"
            />
          </section>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {saved ? t('profile.saved') : saving ? t('common.loading') : t('profile.save')}
          </button>

          {/* Household profiles */}
          {householdTasteProfiles && householdTasteProfiles.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('profile.householdProfiles')}</h2>
              <div className="space-y-4">
                {householdTasteProfiles.map((hp) => (
                  <div key={hp.profileId}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {hp.displayName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{hp.displayName}</span>
                      <span className="text-xs text-gray-400">
                        {t('profile.calculatedFrom', { count: hp.ratingsCount })}
                      </span>
                    </div>
                    <TasteProfileDisplay profile={hp.tasteProfile} mode="user" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
