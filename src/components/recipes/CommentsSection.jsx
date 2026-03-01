import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

function CommentItem({ comment, isOwn, onEdit, onDelete }) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.content)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === comment.content) {
      setEditing(false)
      setEditText(comment.content)
      return
    }
    onEdit(comment.id, trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-white border border-orange-200 rounded-lg px-3 py-2">
        <textarea
          value={editText}
          onChange={e => setEditText(e.target.value)}
          rows={2}
          autoFocus
          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none mb-2"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setEditing(false); setEditText(comment.content) }}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            {t('recipes.ratingDialogCancel')}
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={!editText.trim()}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {t('profile.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-700">{comment.profiles?.display_name}</span>
        <span className="text-[10px] text-gray-400">
          {new Date(comment.created_at).toLocaleDateString()}
        </span>
        {comment.edited_at && (
          <span className="text-[10px] text-gray-400 italic">({t('recipes.commentEdited')})</span>
        )}
        {isOwn && (
          <div className="ml-auto flex items-center gap-1">
            {confirmDelete ? (
              <>
                <button
                  onClick={() => { onDelete(comment.id); setConfirmDelete(false) }}
                  className="text-red-500 text-[10px] font-medium cursor-pointer"
                >
                  {t('recipes.commentDeleteConfirm')}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-gray-400 text-[10px] font-medium cursor-pointer"
                >
                  {t('recipes.ratingDialogCancel')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-gray-400 hover:text-orange-500 cursor-pointer p-0.5"
                  title={t('recipes.commentEdit')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
                  title={t('recipes.commentDelete')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600">{comment.content}</p>
    </div>
  )
}

export default function CommentsSection({ comments, currentUserId, onComment, onEditComment, onDeleteComment }) {
  const { t } = useLanguage()
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (!text.trim()) return
    onComment(text.trim())
    setText('')
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.comments')}</h2>

      {comments.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">{t('recipes.noComments')}</p>
      )}

      <div className="space-y-2 mb-3">
        {comments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            isOwn={c.profile_id === currentUserId}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
          />
        ))}
      </div>

      {/* Add comment */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          placeholder={t('recipes.commentPlaceholder')}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium cursor-pointer transition-colors"
        >
          {t('chat.send')}
        </button>
      </div>
    </div>
  )
}
