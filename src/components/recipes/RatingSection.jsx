import { useState } from 'react'
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

function RatingDialog({ rating, myComments, onConfirm, onCancel, onEditComment, onDeleteComment }) {
  const { t } = useLanguage()
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const startEdit = (comment) => {
    setEditingId(comment.id)
    setEditText(comment.content)
  }

  const saveEdit = (id) => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== myComments.find(c => c.id === id)?.content) {
      onEditComment(id, trimmed)
    }
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm mx-auto p-5 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-900 text-center mb-1">
          {t('recipes.ratingDialogTitle')}
        </h3>
        <p className="text-xs text-gray-500 text-center mb-4">
          {t('recipes.ratingDialogDesc')}
        </p>

        {/* Selected rating display */}
        <div className="flex justify-center mb-4">
          <StarRating rating={rating} />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Existing comments by this user */}
          {myComments.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 mb-2 block">
                {t('recipes.ratingDialogMyComments')}
              </label>
              <div className="space-y-2">
                {myComments.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    {editingId === c.id ? (
                      <>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={2}
                          autoFocus
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none mb-2"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setEditingId(null); setEditText('') }}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                          >
                            {t('recipes.ratingDialogCancel')}
                          </button>
                          <button
                            onClick={() => saveEdit(c.id)}
                            disabled={!editText.trim()}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            {t('profile.save')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-1">
                          <p className="text-sm text-gray-600 flex-1">{c.content}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {confirmDeleteId === c.id ? (
                              <>
                                <button
                                  onClick={() => { onDeleteComment(c.id); setConfirmDeleteId(null) }}
                                  className="text-red-500 text-[10px] font-medium cursor-pointer whitespace-nowrap"
                                >
                                  {t('recipes.commentDeleteConfirm')}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-gray-400 text-[10px] font-medium cursor-pointer"
                                >
                                  {t('recipes.ratingDialogCancel')}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(c)}
                                  className="text-gray-400 hover:text-orange-500 cursor-pointer p-0.5"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(c.id)}
                                  className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {new Date(c.created_at).toLocaleDateString()}
                          {c.edited_at && ` · ${t('recipes.commentEdited')}`}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New comment field */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              {t('recipes.ratingDialogComment')}
            </label>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={t('recipes.ratingDialogPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            {t('recipes.ratingDialogCancel')}
          </button>
          <button
            onClick={() => onConfirm(rating, newComment.trim() || null)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors cursor-pointer"
          >
            {t('recipes.ratingDialogConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RatingSection({ ratings, comments, currentUserId, onRate, onEditComment, onDeleteComment }) {
  const { t } = useLanguage()
  const [pendingRating, setPendingRating] = useState(null)

  const myRating = ratings.find(r => r.profile_id === currentUserId)?.rating || 0
  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null

  // Filtrer les commentaires de l'utilisateur courant
  const myComments = (comments || []).filter(c => c.profile_id === currentUserId)

  const handleStarClick = (star) => {
    setPendingRating(star)
  }

  const handleConfirm = (rating, comment) => {
    onRate(rating, comment)
    setPendingRating(null)
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.ratings')}</h2>

      {/* My rating */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">{t('recipes.yourRating')}</p>
        <StarRating rating={myRating} onRate={handleStarClick} interactive />
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

      {/* Confirmation dialog */}
      {pendingRating !== null && (
        <RatingDialog
          rating={pendingRating}
          myComments={myComments}
          onConfirm={handleConfirm}
          onCancel={() => setPendingRating(null)}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
        />
      )}
    </div>
  )
}
