import { useLanguage } from '../../contexts/LanguageContext'

const CATEGORIES = ['all', 'appetizer', 'main', 'dessert', 'snack', 'drink', 'other']
const DIFFICULTIES = ['all', 'easy', 'medium', 'hard']

export default function RecipeCategoryFilter({ category, onCategoryChange, difficulty, onDifficultyChange }) {
  const { t } = useLanguage()

  return (
    <div className="space-y-2">
      {/* Categories */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              category === cat
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(`recipeCategory.${cat}`)}
          </button>
        ))}
      </div>

      {/* Difficulties */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {DIFFICULTIES.map(diff => (
          <button
            key={diff}
            onClick={() => onDifficultyChange(diff)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              difficulty === diff
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(`recipeDifficulty.${diff}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
