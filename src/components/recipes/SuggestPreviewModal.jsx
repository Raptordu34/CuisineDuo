import { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { apiPost } from '../../lib/apiClient'
import { logAI } from '../../lib/aiLogger'

export default function SuggestPreviewModal({ recipes, onClose, onSave, onRetry, retrying }) {
  const { t } = useLanguage()
  const { profile } = useAuth()
  const [saved, setSaved] = useState(new Set())
  const [saving, setSaving] = useState(null)
  const [images, setImages] = useState({})

  // Generer les images IA pour chaque recette
  useEffect(() => {
    if (!recipes?.length) return
    recipes.forEach((recipe, i) => {
      if (images[i] !== undefined) return
      setImages(prev => ({ ...prev, [i]: null })) // null = en cours
      const t0 = Date.now()
      apiPost('/api/generate-recipe-image', {
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
      }).then(async (res) => {
        const durationMs = Date.now() - t0
        if (res.ok) {
          const data = await res.json()
          setImages(prev => ({ ...prev, [i]: data.imageUrl }))
          logAI({
            householdId: profile?.household_id,
            profileId: profile?.id,
            endpoint: 'generate-recipe-image',
            input: { recipeName: recipe.name },
            output: { success: true, model: data.model || 'unknown', hasImage: !!data.imageUrl },
            durationMs,
          })
        } else {
          const errData = await res.json().catch(() => ({}))
          setImages(prev => ({ ...prev, [i]: false })) // false = echec
          logAI({
            householdId: profile?.household_id,
            profileId: profile?.id,
            endpoint: 'generate-recipe-image',
            input: { recipeName: recipe.name },
            durationMs,
            error: errData.error || `HTTP ${res.status}` + (errData.details ? ` — ${errData.details}` : ''),
          })
        }
      }).catch((err) => {
        setImages(prev => ({ ...prev, [i]: false }))
        logAI({
          householdId: profile?.household_id,
          profileId: profile?.id,
          endpoint: 'generate-recipe-image',
          input: { recipeName: recipe.name },
          durationMs: Date.now() - t0,
          error: err.message || 'Network error',
        })
      })
    })
  }, [recipes]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (recipe, index) => {
    if (saving !== null || saved.has(index)) return
    setSaving(index)
    // Attacher l'image generee (data URL) a la recette avant sauvegarde
    const imageUrl = typeof images[index] === 'string' ? images[index] : null
    await onSave({ ...recipe, image_url: imageUrl })
    setSaved(prev => new Set([...prev, index]))
    setSaving(null)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            <h2 className="font-semibold text-gray-900">{t('recipes.suggestTitle')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {recipes.map((recipe, i) => (
            <div key={i} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
              {/* Image IA */}
              <div className="relative w-full h-40 bg-gray-100">
                {images[i] === null ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : images[i] ? (
                  <img src={images[i]} alt={recipe.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                {recipe.description && (
                  <p className="text-sm text-gray-500 mt-1">{recipe.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                  {recipe.difficulty && <span>{t(`recipeDifficulty.${recipe.difficulty}`)}</span>}
                  {recipe.prep_time && <span>⏱ {recipe.prep_time + (recipe.cook_time || 0)} min</span>}
                  {recipe.servings && <span>🍽 {recipe.servings}</span>}
                </div>
                {recipe.ingredients?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600">{t('recipes.ingredientsLabel')}:</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {recipe.ingredients.map(ing => ing.name || ing).join(', ')}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleSave(recipe, i)}
                  disabled={saving === i || saved.has(i)}
                  className={`mt-3 w-full py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    saved.has(i)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50'
                  }`}
                >
                  {saved.has(i) ? t('recipes.suggestSaved') : saving === i ? '...' : t('recipes.suggestSave')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 space-y-2 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onRetry}
            disabled={retrying}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors"
          >
            {retrying ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
            )}
            {t('recipes.suggestRetry')}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 cursor-pointer"
          >
            {t('recipes.suggestClose')}
          </button>
        </div>
      </div>
    </div>
  )
}
