import { useLanguage } from '../../contexts/LanguageContext'

function StarRating({ rating, onRate, interactive = false }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={interactive ? () => onRate(star) : undefined}
          disabled={!interactive}
          className={`text-lg ${interactive ? 'cursor-pointer' : 'cursor-default'} ${
            star <= rating ? 'text-yellow-400' : 'text-gray-200'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function RatingSection({ ratings, currentUserId, onRate }) {
  const { t } = useLanguage()

  const myRating = ratings.find(r => r.profile_id === currentUserId)?.rating || 0
  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.ratings')}</h2>

      {/* My rating */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">{t('recipes.yourRating')}</p>
        <StarRating rating={myRating} onRate={onRate} interactive />
      </div>

      {/* Average */}
      {avgRating && (
        <p className="text-xs text-gray-500 mb-2">
          {t('recipes.averageRating')}: <span className="font-medium text-yellow-600">★ {avgRating}</span> ({ratings.length})
        </p>
      )}

      {/* Others */}
      {ratings.filter(r => r.profile_id !== currentUserId).length > 0 && (
        <div className="space-y-1">
          {ratings.filter(r => r.profile_id !== currentUserId).map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{r.profiles?.display_name}</span>
              <StarRating rating={r.rating} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
