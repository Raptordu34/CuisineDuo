import { useLanguage } from '../../contexts/LanguageContext'
import InventoryItemCard from './InventoryItemCard'

export default function InventoryList({
  items, category, onEdit, onConsume,
  selectionMode, selectedIds, onLongPress, onToggleSelect,
}) {
  const { t } = useLanguage()

  const filtered = category === 'all'
    ? items
    : items.filter((item) => item.category === category)

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>{t('inventory.empty')}</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>{t('inventory.emptyFiltered')}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {filtered.map((item) => (
        <InventoryItemCard
          key={item.id}
          item={item}
          onEdit={onEdit}
          onConsume={onConsume}
          selectionMode={selectionMode}
          selected={selectedIds?.has(item.id)}
          onLongPress={onLongPress}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  )
}
