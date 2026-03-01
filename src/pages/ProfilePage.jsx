import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

const TASTE_AXES = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']

const DIET_OPTIONS = ['vegetarian', 'vegan', 'glutenFree', 'lactoseFree', 'halal', 'kosher', 'nutFree']

export default function ProfilePage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [householdName, setHouseholdName] = useState('')
  const [tasteValues, setTasteValues] = useState(
    Object.fromEntries(TASTE_AXES.map(a => [a, 3]))
  )
  const [restrictions, setRestrictions] = useState([])
  const [bannedIngredients, setBannedIngredients] = useState([])
  const [bannedInput, setBannedInput] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Fetch household name + existing taste preferences
  useEffect(() => {
    if (!profile?.household_id) return

    supabase
      .from('households')
      .select('name')
      .eq('id', profile.household_id)
      .single()
      .then(({ data }) => { if (data) setHouseholdName(data.name) })

    supabase
      .from('taste_preferences')
      .select('*')
      .eq('profile_id', profile.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const newValues = {}
          for (const axis of TASTE_AXES) {
            newValues[axis] = data[axis] ?? 3
          }
          setTasteValues(newValues)
          setRestrictions(Array.isArray(data.dietary_restrictions) ? data.dietary_restrictions : [])
          setBannedIngredients(Array.isArray(data.banned_ingredients) ? data.banned_ingredients : [])
          setNotes(data.additional_notes || '')
        }
      })
  }, [profile?.household_id, profile?.id])

  const toggleRestriction = (key) => {
    setRestrictions(prev =>
      prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
    )
  }

  const addBannedIngredient = () => {
    const val = bannedInput.trim()
    if (!val || bannedIngredients.includes(val)) return
    setBannedIngredients(prev => [...prev, val])
    setBannedInput('')
  }

  const removeBannedIngredient = (item) => {
    setBannedIngredients(prev => prev.filter(i => i !== item))
  }

  const handleSave = async () => {
    if (!profile?.id) return
    setSaving(true)
    setSaved(false)

    const payload = {
      profile_id: profile.id,
      ...tasteValues,
      dietary_restrictions: restrictions,
      banned_ingredients: bannedIngredients,
      additional_notes: notes || null,
      updated_at: new Date().toISOString(),
    }

    await supabase
      .from('taste_preferences')
      .upsert(payload, { onConflict: 'profile_id' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const initial = profile?.display_name?.charAt(0)?.toUpperCase() || '?'

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white text-xl font-bold">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900 truncate">{profile?.display_name}</div>
            {householdName && (
              <div className="text-xs text-gray-500">{t('profile.household', { name: householdName })}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {/* Taste axes */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">{t('profile.tasteTitle')}</h2>
          <div className="space-y-3">
            {TASTE_AXES.map(axis => (
              <div key={axis}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-700">{t(`profile.${axis}`)}</span>
                  <span className="text-xs text-gray-400">{tasteValues[axis]}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-8">{t('profile.tasteLow')}</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={tasteValues[axis]}
                    onChange={e => setTasteValues(prev => ({ ...prev, [axis]: Number(e.target.value) }))}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-orange-500"
                    style={{
                      background: `linear-gradient(to right, #f97316 ${((tasteValues[axis] - 1) / 4) * 100}%, #e5e7eb ${((tasteValues[axis] - 1) / 4) * 100}%)`,
                    }}
                  />
                  <span className="text-[10px] text-gray-400 w-8 text-right">{t('profile.tasteHigh')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dietary restrictions */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">{t('profile.restrictionsTitle')}</h2>
          <div className="flex flex-wrap gap-2">
            {DIET_OPTIONS.map(key => (
              <button
                key={key}
                onClick={() => toggleRestriction(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  restrictions.includes(key)
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(`diet.${key}`)}
              </button>
            ))}
          </div>
        </section>

        {/* Banned ingredients */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">{t('profile.bannedTitle')}</h2>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={bannedInput}
              onChange={e => setBannedInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBannedIngredient() } }}
              placeholder={t('profile.bannedPlaceholder')}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={addBannedIngredient}
              disabled={!bannedInput.trim()}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              +
            </button>
          </div>
          {bannedIngredients.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {bannedIngredients.map(item => (
                <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs">
                  {item}
                  <button
                    onClick={() => removeBannedIngredient(item)}
                    className="text-red-400 hover:text-red-600 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">{t('profile.notesTitle')}</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('profile.notesPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none"
          />
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
          }`}
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : saved ? (
            t('profile.saved')
          ) : (
            t('profile.save')
          )}
        </button>
      </div>
    </div>
  )
}
