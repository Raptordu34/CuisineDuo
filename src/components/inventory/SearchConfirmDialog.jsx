import { useLanguage } from '../../contexts/LanguageContext'

export default function SearchConfirmDialog({ searchQuery, searchReason, onConfirm, onCancel }) {
  const { t } = useLanguage()

  return (
    <div className="mx-3 mb-2 rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-500 shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-blue-900">{t('inventory.searchNeeded')}</p>
          {searchReason && (
            <p className="text-xs text-blue-700">
              <span className="font-medium">{t('inventory.searchReason')} : </span>
              {searchReason}
            </p>
          )}
          <p className="text-xs text-blue-600 italic">&ldquo;{searchQuery}&rdquo;</p>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-full transition-colors cursor-pointer"
        >
          {t('inventory.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-full transition-colors cursor-pointer"
        >
          {t('inventory.allowSearch')}
        </button>
      </div>
    </div>
  )
}
