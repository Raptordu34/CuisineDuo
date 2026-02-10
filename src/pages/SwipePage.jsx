import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useSwipeSession } from '../hooks/useSwipeSession'
import SwipeStack from '../components/swipe/SwipeStack'
import SwipeWaitingState from '../components/swipe/SwipeWaitingState'

export default function SwipePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useLanguage()

  const {
    session,
    recipes,
    unvotedRecipes,
    myVotes,
    membersProgress,
    loading,
    vote,
    cancelSession,
    isComplete,
  } = useSwipeSession(sessionId, profile?.id, profile?.household_id)

  const handleCancel = useCallback(async () => {
    await cancelSession()
    navigate('/')
  }, [cancelSession, navigate])

  const handleVote = useCallback(async (recipeId, liked) => {
    await vote(recipeId, liked)

    // Send notification if this was the last vote for this member
    if (myVotes.length + 1 >= recipes.length && profile?.household_id) {
      try {
        await fetch('/api/push-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            household_id: profile.household_id,
            sender_profile_id: profile.id,
            title: 'CuisineDuo',
            body: t('swipe.votingDoneNotif', { name: profile.display_name }),
          }),
        })
      } catch {
        // Notification failed, not critical
      }
    }
  }, [vote, myVotes.length, recipes.length, profile, t])

  const handleExit = useCallback(() => {
    navigate('/')
  }, [navigate])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-400">{t('swipe.notFound')}</p>
        <button onClick={handleExit} className="text-orange-400 hover:text-orange-300 text-sm cursor-pointer">
          {t('recipes.back')}
        </button>
      </div>
    )
  }

  if (session.status === 'cancelled') {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-lg font-medium">{t('swipe.sessionFailed')}</p>
        <p className="text-gray-500 text-sm">{t('swipe.sessionFailedDesc')}</p>
        <button
          onClick={handleExit}
          className="mt-2 px-6 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-colors cursor-pointer"
        >
          {t('recipes.back')}
        </button>
      </div>
    )
  }

  if (session.status === 'generating') {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-gray-300 text-lg font-medium">{t('swipe.generating')}</p>
        <p className="text-gray-500 text-sm">{t('swipe.generatingDesc')}</p>
        <button
          onClick={handleCancel}
          className="mt-4 px-6 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-full transition-colors cursor-pointer"
        >
          {t('common.cancel')}
        </button>
      </div>
    )
  }

  const votedCount = myVotes.length
  const totalCount = recipes.length
  const myDone = votedCount >= totalCount && totalCount > 0

  // All done → redirect to results
  if (isComplete) {
    navigate(`/swipe/${sessionId}/results`, { replace: true })
    return null
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleExit}
            className="shrink-0 w-8 h-8 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-sm font-medium text-white truncate">{session.title || t('swipe.title')}</h1>
        </div>
        <span className="text-xs text-gray-400">
          {votedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 h-1 bg-gray-800">
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${totalCount > 0 ? (votedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {/* Main content */}
      {myDone ? (
        <div className="flex-1 flex items-center justify-center">
          <SwipeWaitingState membersProgress={membersProgress} />
        </div>
      ) : (
        <>
          {/* Swipe area */}
          <div className="flex-1 flex items-center justify-center px-4 py-6">
            <SwipeStack recipes={unvotedRecipes} onVote={handleVote} />
          </div>

          {/* Bottom buttons */}
          <div className="shrink-0 px-6 py-4 flex items-center justify-center gap-8">
            <button
              onClick={() => unvotedRecipes[0] && handleVote(unvotedRecipes[0].id, false)}
              className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 text-red-500 flex items-center justify-center cursor-pointer hover:bg-red-500/30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <button
              onClick={() => unvotedRecipes[0] && handleVote(unvotedRecipes[0].id, true)}
              className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 text-green-500 flex items-center justify-center cursor-pointer hover:bg-green-500/30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
