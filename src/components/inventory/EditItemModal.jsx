import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import FillLevelPicker from '../FillLevelPicker'

const CATEGORIES = [
  'dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains',
  'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other',
]

const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack']

export default function EditItemModal({ item, onClose, onSave, onDelete }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    name: item.name,
    brand: item.brand || '',
    quantity: item.quantity,
    unit: item.unit || 'piece',
    fill_level: item.fill_level ?? 1,
    price: item.price ?? '',
    price_per_kg: item.price_per_kg ?? '',
    category: item.category || 'other',
    store: item.store || '',
    notes: item.notes || '',
    estimated_expiry_date: item.estimated_expiry_date || '',
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    await onSave(item.id, {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      fill_level: form.fill_level,
      price: form.price ? parseFloat(form.price) : null,
      price_per_kg: form.price_per_kg ? parseFloat(form.price_per_kg) : null,
      category: form.category,
      store: form.store.trim() || null,
      notes: form.notes.trim() || null,
      estimated_expiry_date: form.estimated_expiry_date || null,
    })
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    await onDelete(item.id)
    setSaving(false)
  }

  const toKg = (q, u) => {
    if (u === 'kg' || u === 'l') return q
    if (u === 'g' || u === 'ml') return q / 1000
    return null
  }

  const update = (field, value) => setForm((prev) => {
    const next = { ...prev, [field]: value }
    const qty = parseFloat(next.quantity) || 0
    const unit = next.unit
    const price = parseFloat(next.price) || 0
    const pricePkg = parseFloat(next.price_per_kg) || 0
    const qtyKg = toKg(qty, unit)

    if (qtyKg && qtyKg > 0) {
      if ((field === 'price' || field === 'quantity' || field === 'unit') && price > 0) {
        next.price_per_kg = Math.round((price / qtyKg) * 100) / 100
      } else if (field === 'price_per_kg' && pricePkg > 0) {
        next.price = Math.round((pricePkg * qtyKg) * 100) / 100
      }
    }
    return next
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('inventory.editItem')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.name')} *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.brand')}</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => update('brand', e.target.value)}
                placeholder={t('inventory.brandPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.quantity')}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.unit')}</label>
              <select
                value={form.unit}
                onChange={(e) => update('unit', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{t(`unit.${u}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.price')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.pricePerKg')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price_per_kg}
                onChange={(e) => update('price_per_kg', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.fillLevel')}</label>
            <FillLevelPicker value={form.fill_level} onChange={(v) => update('fill_level', v)} size="md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.category')}</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`category.${c}`)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.store')}</label>
              <input
                type="text"
                value={form.store}
                onChange={(e) => update('store', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.expiryDate')}</label>
              <input
                type="date"
                value={form.estimated_expiry_date}
                onChange={(e) => update('estimated_expiry_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                confirmDelete
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border border-red-300 text-red-500 hover:bg-red-50'
              } disabled:opacity-50`}
            >
              {confirmDelete ? t('inventory.confirm') : t('inventory.delete')}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t('inventory.cancel')}
            </button>
            <button
              type="submit"
              disabled={!form.name.trim() || saving}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('inventory.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
