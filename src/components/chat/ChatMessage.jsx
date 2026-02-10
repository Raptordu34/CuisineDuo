import { useState, useRef, useCallback } from 'react'

export default function ChatMessage({
  msg,
  isMine,
  isGrouped,
  showAvatar,
  onReply,
  onLongPress,
  onDoubleTap,
  onScrollToMessage,
  reactions,
  myProfileId,
  onToggleReaction,
  renderMarkdown,
  formatTime,
  t,
}) {
  const isAI = msg.is_ai
  const [swipeX, setSwipeX] = useState(0)
  const touchStartRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const lastTapRef = useRef(0)
  const messageRef = useRef(null)

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30)
      onLongPress(msg, messageRef.current)
      touchStartRef.current = null
    }, 500)
  }, [msg, onLongPress])

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y

    // Cancel long press if moved too much
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(longPressTimerRef.current)
    }

    // Only horizontal swipe (not vertical scrolling)
    if (Math.abs(dy) > Math.abs(dx)) return

    // Swipe right to reply
    if (dx > 0) {
      e.preventDefault()
      setSwipeX(Math.min(dx, 80))
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
    if (swipeX >= 60) {
      if (navigator.vibrate) navigator.vibrate(20)
      onReply(msg)
    }
    setSwipeX(0)
    touchStartRef.current = null
  }, [swipeX, msg, onReply])

  const handleClick = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      onDoubleTap(msg)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [msg, onDoubleTap])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    onLongPress(msg, messageRef.current)
  }, [msg, onLongPress])

  const replyTo = msg.reply_to
  const msgReactions = reactions || []

  // Group reactions by emoji
  const groupedReactions = {}
  msgReactions.forEach(r => {
    if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = []
    groupedReactions[r.emoji].push(r.profile_id)
  })

  const initial = msg.profiles?.display_name?.charAt(0)?.toUpperCase() || '?'
  const name = msg.profiles?.display_name || '?'

  const avatarEl = isAI ? (
    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs shrink-0">
      🤖
    </div>
  ) : (
    <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initial}
    </div>
  )

  const mine = isMine && !isAI

  return (
    <div
      ref={messageRef}
      id={`msg-${msg.id}`}
      className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
      style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Swipe reply indicator */}
      {swipeX > 20 && (
        <div className="absolute left-0 flex items-center justify-center w-8 h-8 text-gray-400" style={{ transform: `translateX(-${40 - swipeX * 0.5}px)` }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          </svg>
        </div>
      )}

      {/* Avatar */}
      {!mine && showAvatar && avatarEl}
      {!mine && !showAvatar && <div className="w-7 shrink-0" />}

      <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Name (only first in group) */}
        {!mine && showAvatar && (
          <span className={`text-xs mb-0.5 ml-1 ${isAI ? 'text-indigo-500 font-medium' : 'text-gray-500'}`}>
            {isAI ? 'Miam' : name}
          </span>
        )}

        {/* Reply/Quote block */}
        {replyTo && (
          <button
            onClick={(e) => { e.stopPropagation(); onScrollToMessage(replyTo.id) }}
            className={`text-xs px-2 py-1 rounded-lg mb-1 max-w-full truncate cursor-pointer ${
              mine ? 'bg-orange-400/30 text-orange-100' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className="font-medium">
              {replyTo.is_ai ? 'Miam' : replyTo.profiles?.display_name || '?'}
            </span>
            {': '}
            {replyTo.content?.slice(0, 60)}{replyTo.content?.length > 60 ? '...' : ''}
          </button>
        )}

        {/* Message bubble */}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isAI
              ? 'bg-indigo-50 text-indigo-900 rounded-bl-md shadow-sm'
              : mine
                ? 'bg-orange-500 text-white rounded-br-md'
                : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
          }`}
        >
          {isAI ? renderMarkdown(msg.content) : msg.content}
        </div>

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-0.5 ${mine ? 'mr-1' : 'ml-1'}`}>
            {Object.entries(groupedReactions).map(([emoji, profileIds]) => {
              const isMineReaction = profileIds.includes(myProfileId)
              return (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); onToggleReaction(msg.id, emoji) }}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
                    isMineReaction
                      ? 'bg-indigo-100 border border-indigo-300'
                      : 'bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span>{emoji}</span>
                  {profileIds.length > 1 && <span className="text-gray-500">{profileIds.length}</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Timestamp */}
        <span className={`text-[10px] text-gray-400 mt-0.5 ${mine ? 'mr-1' : 'ml-1'}`}>
          {formatTime(msg.created_at)}
        </span>
      </div>
    </div>
  )
}
