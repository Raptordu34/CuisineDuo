import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'

export default function RecipeRating({ recipeId, profileId }) {
  const { t } = useLanguage()
  const [rating, setRating] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchRating = useCallback(async () => {
    if (!recipeId || !profileId) return
    const { data } = await supabase
      .from('recipe_ratings')
      .select('rating')
      .eq('recipe_id', recipeId)
      .eq('profile_id', profileId)
      .single()
    if (data) setRating(data.rating)
  }, [recipeId, profileId])

  useEffect(() => {
    fetchRating()
  }, [fetchRating])

  const handleRate = async (value) => {
    if (saving) return
    setSaving(true)
    setRating(value)
    await supabase.from('recipe_ratings').upsert({
      recipe_id: recipeId,
      profile_id: profileId,
      rating: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'recipe_id,profile_id' })
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 font-medium">{t('recipes.yourRating')}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            disabled={saving}
            className="cursor-pointer p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={star <= (hovered || rating) ? '#f59e0b' : '#e5e7eb'}
              className="w-6 h-6 transition-colors"
            >
              <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
            </svg>
          </button>
        ))}
      </div>
      {rating && (
        <span className="text-xs text-gray-400">{rating}/5</span>
      )}
    </div>
  )
}
