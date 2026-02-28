import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function CommentsSection({ comments, onComment }) {
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
          <div key={c.id} className="bg-white border border-gray-100 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-700">{c.profiles?.display_name}</span>
              <span className="text-[10px] text-gray-400">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm text-gray-600">{c.content}</p>
          </div>
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
