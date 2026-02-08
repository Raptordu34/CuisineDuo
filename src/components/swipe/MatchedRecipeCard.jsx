import { useLanguage } from '../../contexts/LanguageContext'

export default function MatchedRecipeCard({ recipe, selected, onToggle }) {
  const { t } = useLanguage()
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left rounded-xl border-2 overflow-hidden transition-colors cursor-pointer ${
        selected
          ? 'border-green-500 bg-green-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="shrink-0 w-20 h-20 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 overflow-hidden">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">🍽️</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{recipe.name}</h3>
            <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selected ? 'bg-green-500 border-green-500' : 'border-gray-300'
            }`}>
              {selected && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </div>
          </div>

          {recipe.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{recipe.description}</p>
          )}

          <div className="flex flex-wrap gap-1 mt-1.5">
            {recipe.category && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-medium">
                {t(`recipeCategory.${recipe.category}`)}
              </span>
            )}
            {recipe.difficulty && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                {t(`difficulty.${recipe.difficulty}`)}
              </span>
            )}
            {totalTime > 0 && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                {totalTime} {t('recipes.min')}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
