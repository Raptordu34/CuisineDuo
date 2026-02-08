import { useLanguage } from '../../contexts/LanguageContext'

export default function ShoppingListSelector({ lists, activeListId, onSelect }) {
  const { t } = useLanguage()

  if (lists.length <= 1) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {lists.map((list) => (
        <button
          key={list.id}
          onClick={() => onSelect(list.id)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            list.id === activeListId
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {list.name || t('shopping.untitled')}
        </button>
      ))}
    </div>
  )
}
