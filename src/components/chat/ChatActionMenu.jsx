import { useEffect, useRef } from 'react'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🤔', '👏']

export default function ChatActionMenu({
  msg,
  anchorEl,
  isMine,
  onClose,
  onReply,
  onCopy,
  onDelete,
  onReact,
  t,
}) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [onClose])

  // Position menu near the anchor element
  let style = {}
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect()
    const menuHeight = 160
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow > menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4
    style = {
      position: 'fixed',
      top: Math.max(8, top),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)),
      zIndex: 100,
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99] bg-black/10" />

      <div
        ref={menuRef}
        style={style}
        className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden min-w-[200px] z-[100]"
      >
        {/* Reaction picker */}
        <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact(msg.id, emoji); onClose() }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-lg cursor-pointer transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="py-1">
          <button
            onClick={() => { onReply(msg); onClose() }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            {t('chat.reply')}
          </button>
          <button
            onClick={() => { onCopy(msg.content); onClose() }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
            </svg>
            {t('chat.copy')}
          </button>
          {isMine && (
            <button
              onClick={() => { onDelete(msg.id); onClose() }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              {t('chat.delete')}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
