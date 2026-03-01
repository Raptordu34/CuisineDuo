import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function SuggestConfigModal({ onConfirm, onClose }) {
  const { t } = useLanguage()
  const [inventoryCount, setInventoryCount] = useState(2)
  const discoveryCount = 3 - inventoryCount

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm mx-auto p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <h2 className="text-base font-bold text-gray-900 text-center mb-5">
          {t('recipes.suggestConfig.title')}
        </h2>

        {/* Slider */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={inventoryCount}
            onChange={e => setInventoryCount(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-orange-500"
            style={{
              background: `linear-gradient(to right, #f97316 ${(inventoryCount / 3) * 100}%, #6366f1 ${(inventoryCount / 3) * 100}%)`,
            }}
          />
          {/* Tick marks */}
          <div className="flex justify-between px-0.5 mt-1">
            {[0, 1, 2, 3].map(v => (
              <button
                key={v}
                onClick={() => setInventoryCount(v)}
                className={`w-6 h-6 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  inventoryCount === v
                    ? 'bg-orange-500 text-white scale-110'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div className="flex justify-between gap-3 mb-5">
          <div className="flex-1 text-center p-3 rounded-xl bg-orange-50 border border-orange-200">
            <div className="text-xs font-semibold text-orange-600 mb-1">
              {t('recipes.suggestConfig.inventory')}
            </div>
            <div className="text-[11px] text-orange-500">
              {t('recipes.suggestConfig.inventoryDesc', { count: inventoryCount })}
            </div>
          </div>
          <div className="flex-1 text-center p-3 rounded-xl bg-indigo-50 border border-indigo-200">
            <div className="text-xs font-semibold text-indigo-600 mb-1">
              {t('recipes.suggestConfig.discovery')}
            </div>
            <div className="text-[11px] text-indigo-500">
              {t('recipes.suggestConfig.discoveryDesc', { count: discoveryCount })}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            {t('profile.back')}
          </button>
          <button
            onClick={() => onConfirm({ inventoryCount, discoveryCount })}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors cursor-pointer"
          >
            {t('recipes.suggestConfig.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
