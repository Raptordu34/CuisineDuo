import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function RecipeComments({ recipeId }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('recipe_comments')
      .select('*, profiles(display_name)')
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }, [recipeId])

  useEffect(() => {
    fetchComments()

    const channel = supabase
      .channel(`recipe_comments:${recipeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipe_comments',
          filter: `recipe_id=eq.${recipeId}`,
        },
        () => fetchComments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [recipeId, fetchComments])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = newComment.trim()
    if (!content || sending) return

    setSending(true)
    await supabase.from('recipe_comments').insert({
      recipe_id: recipeId,
      profile_id: profile.id,
      content,
    })
    setNewComment('')
    setSending(false)
  }

  const handleDelete = async (commentId) => {
    await supabase.from('recipe_comments').delete().eq('id', commentId)
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{t('recipes.comments')}</h3>

      {comments.length === 0 && (
        <p className="text-xs text-gray-400">{t('recipes.noComments')}</p>
      )}

      {comments.map((comment) => {
        const isMine = comment.profile_id === profile.id
        const initial = comment.profiles?.display_name?.charAt(0)?.toUpperCase() || '?'
        const name = comment.profiles?.display_name || '?'

        return (
          <div key={comment.id} className="flex gap-2 items-start">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 mt-0.5">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">{name}</span>
                <span className="text-[10px] text-gray-400">{formatTime(comment.created_at)}</span>
                {isMine && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-[10px] text-red-400 hover:text-red-600 cursor-pointer"
                  >
                    {t('recipes.deleteComment')}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{comment.content}</p>
            </div>
          </div>
        )
      })}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('recipes.addComment')}
          className="flex-1 border border-gray-300 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || sending}
          className="shrink-0 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {t('chat.send')}
        </button>
      </form>
    </div>
  )
}
