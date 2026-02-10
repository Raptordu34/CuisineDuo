import { useLanguage } from '../../contexts/LanguageContext'

export default function ChatSuggestionChips({ onSelect }) {
  const { t } = useLanguage()

  const chips = [
    { key: 'whatToCook', label: t('chat.chipWhatToCook'), icon: '🍳' },
    { key: 'expiring', label: t('chat.chipExpiring'), icon: '⏰' },
    { key: 'quickMeal', label: t('chat.chipQuickMeal'), icon: '⚡' },
    { key: 'leftovers', label: t('chat.chipLeftovers'), icon: '♻️' },
    { key: 'mealPlan', label: t('chat.chipMealPlan'), icon: '📅' },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
      {chips.map(chip => (
        <button
          key={chip.key}
          onClick={() => onSelect(chip.label)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer shadow-sm"
        >
          <span>{chip.icon}</span>
          <span className="whitespace-nowrap">{chip.label}</span>
        </button>
      ))}
    </div>
  )
}
