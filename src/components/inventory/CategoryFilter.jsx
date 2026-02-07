import { useLanguage } from '../../contexts/LanguageContext'

const CATEGORIES = [
  'all', 'dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains',
  'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other',
]

export default function CategoryFilter({ selected, onSelect }) {
  const { t } = useLanguage()

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            selected === cat
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t(`category.${cat}`)}
        </button>
      ))}
    </div>
  )
}

export { CATEGORIES }
