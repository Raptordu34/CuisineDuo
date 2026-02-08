import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function RecipeSearchResultsModal({ results, onSelectExisting, onSelectSuggestion, onClose, generatingSuggestion }) {
  const { t } = useLanguage()
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)

  const handleSuggestionClick = (suggestion, idx) => {
    setSelectedSuggestion(idx)
    onSelectSuggestion(suggestion)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 pb-16 md:pb-0" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{t('recipes.aiSearchResults')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        {/* Summary */}
        {results.summary && (
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-sm text-gray-600 italic">{results.summary}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Matching recipes */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.matchingRecipes')}</h3>
            {results.matching_recipes?.length > 0 ? (
              <div className="space-y-2">
                {results.matching_recipes.map((match, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectExisting(match.recipe_id)}
                    className="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-orange-50 hover:border-orange-200 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-gray-900">{match.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{match.relevance_reason}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">{t('recipes.noMatchingRecipes')}</p>
            )}
          </section>

          {/* New ideas */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.newRecipeIdeas')}</h3>
            <div className="space-y-2">
              {results.suggestions?.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion, i)}
                  disabled={generatingSuggestion}
                  className="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-green-50 hover:border-green-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{suggestion.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{suggestion.description}</p>
                    </div>
                    {generatingSuggestion && selectedSuggestion === i ? (
                      <span className="text-xs text-green-600 animate-pulse shrink-0">{t('recipes.generatingRecipe')}</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-500 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('recipes.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
