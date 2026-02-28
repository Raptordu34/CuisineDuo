import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function StoreSelectDialog({ onConfirm, onSkip }) {
  const { t } = useLanguage()
  const [store, setStore] = useState(() => localStorage.getItem('preferredStore') || '')

  const handleConfirm = () => {
    const trimmed = store.trim()
    if (trimmed) {
      localStorage.setItem('preferredStore', trimmed)
    }
    onConfirm(trimmed || null)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={onSkip}>
      <div
        className="bg-white w-[90%] max-w-sm rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900">{t('inventory.storeSelectTitle')}</h2>
        <input
          type="text"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder={t('inventory.storeNamePlaceholder')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
        />
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('inventory.storeSkip')}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {t('inventory.storeConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
