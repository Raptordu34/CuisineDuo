import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import StarRatingInline from './StarRatingInline'

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}

export default function RecipeCard({ recipe, onClick, onDelete, rating = 0, onRate }) {
  const { t } = useLanguage()
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef(null)

  useEffect(() => {
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }
  }, [])

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (confirmDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      setConfirmDelete(false)
      onDelete?.(recipe.id)
    } else {
      setConfirmDelete(true)
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(recipe)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(recipe) } }}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden text-left transition-shadow hover:shadow-md cursor-pointer w-full"
    >
      {/* Image */}
      <div className="aspect-[16/10] bg-gradient-to-br from-orange-100 to-amber-50 relative overflow-hidden">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
            🍽️
          </div>
        )}
        {recipe.category && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 rounded-full text-[10px] font-medium text-gray-600">
            {t(`recipeCategory.${recipe.category}`)}
          </span>
        )}
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors cursor-pointer ${
              confirmDelete
                ? 'bg-red-500 text-white'
                : 'bg-white/80 text-gray-500 hover:text-red-500 hover:bg-white'
            }`}
            title={confirmDelete ? t('recipes.deleteConfirm') : t('recipes.delete')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{recipe.name}</h3>
        {recipe.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{recipe.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {totalTime > 0 && (
            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {totalTime} {t('recipes.min')}
            </span>
          )}
          {recipe.servings && (
            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              {recipe.servings}
            </span>
          )}
          {recipe.difficulty && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[recipe.difficulty] || ''}`}>
              {t(`difficulty.${recipe.difficulty}`)}
            </span>
          )}
        </div>
        {onRate && (
          <div className="mt-1.5">
            <StarRatingInline
              value={rating}
              onChange={(value) => onRate(recipe.id, value)}
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  )
}
