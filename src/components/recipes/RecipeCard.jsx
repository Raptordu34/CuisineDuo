import { useLanguage } from '../../contexts/LanguageContext'
import { getTranslatedRecipe } from '../../lib/recipeTranslations'

const CATEGORY_COLORS = {
  appetizer: 'bg-amber-200',
  main: 'bg-red-200',
  dessert: 'bg-pink-200',
  snack: 'bg-purple-200',
  drink: 'bg-cyan-200',
  other: 'bg-gray-200',
}

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}

export default function RecipeCard({ recipe, feasibility, onClick }) {
  const { t, lang } = useLanguage()
  const tr = getTranslatedRecipe(recipe, lang)

  const avgRating = recipe.recipe_ratings?.length
    ? (recipe.recipe_ratings.reduce((s, r) => s + r.rating, 0) / recipe.recipe_ratings.length).toFixed(1)
    : null

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  const lastCooked = recipe.cooking_history?.length
    ? recipe.cooking_history.sort((a, b) => new Date(b.cooked_at) - new Date(a.cooked_at))[0]?.cooked_at
    : null

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Image or placeholder */}
      {recipe.image_url ? (
        <img src={recipe.image_url} alt={tr.name} className="w-full h-28 object-cover" />
      ) : (
        <div className={`w-full h-28 flex items-center justify-center ${CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS.other}`}>
          <span className="text-4xl font-bold text-white/60">{tr.name.charAt(0).toUpperCase()}</span>
        </div>
      )}

      <div className="p-2.5">
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 truncate">{tr.name}</h3>

        {/* Rating & time */}
        <div className="flex items-center gap-2 mt-1">
          {avgRating && (
            <span className="text-xs text-yellow-600 font-medium">★ {avgRating}</span>
          )}
          {totalTime > 0 && (
            <span className="text-xs text-gray-400">{totalTime} min</span>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {recipe.difficulty && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${DIFFICULTY_COLORS[recipe.difficulty] || ''}`}>
              {t(`recipeDifficulty.${recipe.difficulty}`)}
            </span>
          )}
          {feasibility === 'full' && (
            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
              {t('recipes.feasible')}
            </span>
          )}
          {feasibility === 'partial' && (
            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-medium">
              {t('recipes.partial')}
            </span>
          )}
        </div>

        {/* Last cooked */}
        {lastCooked && (
          <p className="text-[10px] text-gray-400 mt-1">
            {t('recipes.lastCooked')}: {new Date(lastCooked).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
