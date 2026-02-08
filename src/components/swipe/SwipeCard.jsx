import { useLanguage } from '../../contexts/LanguageContext'

const DIFFICULTY_COLORS = {
  easy: 'bg-green-500/80',
  medium: 'bg-yellow-500/80',
  hard: 'bg-red-500/80',
}

export default function SwipeCard({ recipe, style, overlay }) {
  const { t } = useLanguage()
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  return (
    <div
      className="absolute inset-0 rounded-2xl overflow-hidden bg-white shadow-xl select-none"
      style={{ touchAction: 'none', ...style }}
    >
      {/* Image area - 60% */}
      <div className="relative h-[60%] bg-gradient-to-br from-orange-100 to-amber-50">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover"
            draggable={false}
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl opacity-20">
            🍽️
          </div>
        )}

        {/* Overlay during drag */}
        {overlay === 'like' && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
            <span className="text-5xl font-black text-green-500 border-4 border-green-500 rounded-xl px-6 py-2 rotate-[-15deg]">
              LIKE
            </span>
          </div>
        )}
        {overlay === 'nope' && (
          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
            <span className="text-5xl font-black text-red-500 border-4 border-red-500 rounded-xl px-6 py-2 rotate-[15deg]">
              NOPE
            </span>
          </div>
        )}
      </div>

      {/* Text area - 40% */}
      <div className="h-[40%] p-4 flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight line-clamp-2">{recipe.name}</h2>
          {recipe.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{recipe.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {recipe.category && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">
              {t(`recipeCategory.${recipe.category}`)}
            </span>
          )}
          {recipe.difficulty && (
            <span className={`px-2 py-0.5 text-white rounded-full text-xs font-medium ${DIFFICULTY_COLORS[recipe.difficulty] || 'bg-gray-500'}`}>
              {t(`difficulty.${recipe.difficulty}`)}
            </span>
          )}
          {totalTime > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              {totalTime} {t('recipes.min')}
            </span>
          )}
          {recipe.servings && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              {recipe.servings} {t('recipes.servings').toLowerCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
