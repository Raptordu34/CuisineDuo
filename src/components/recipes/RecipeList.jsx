import { useLanguage } from '../../contexts/LanguageContext'
import RecipeCard from './RecipeCard'

export default function RecipeList({ recipes, category, search, onClick, onDelete, ratings = {}, onRate }) {
  const { t } = useLanguage()

  let filtered = category === 'all'
    ? recipes
    : recipes.filter((r) => r.category === category)

  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter((r) => r.name.toLowerCase().includes(q))
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>{t('recipes.empty')}</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>{t('recipes.emptyFiltered')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {filtered.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onClick={onClick} onDelete={onDelete} rating={ratings[recipe.id] || 0} onRate={onRate} />
      ))}
    </div>
  )
}
