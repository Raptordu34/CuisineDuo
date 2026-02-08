import { useLanguage } from '../../contexts/LanguageContext'

const RECIPE_CATEGORIES = [
  'all', 'appetizer', 'main', 'dessert', 'snack', 'drink',
  'soup', 'salad', 'side', 'breakfast', 'other',
]

export default function RecipeCategoryFilter({ selected, onSelect }) {
  const { t } = useLanguage()

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {RECIPE_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            selected === cat
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t(`recipeCategory.${cat}`)}
        </button>
      ))}
    </div>
  )
}

export { RECIPE_CATEGORIES }
