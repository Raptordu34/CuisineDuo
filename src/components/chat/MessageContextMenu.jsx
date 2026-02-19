import { useEffect, useRef } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export default function MessageContextMenu({
  messageId,
  position,
  isMine,
  isGif,
  isAI,
  isDeleted,
  onSelectEmoji,
  onOpenFullPicker,
  onReply,
  onDelete,
  onCopy,
  onEdit,
  onClose,
}) {
  const { t } = useLanguage()
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [onClose])

  // Positionnement : au-dessus du point de tap, ajusté aux bords
  const menuWidth = 272
  const margin = 8

  let top = position.y - 120 - margin
  if (top < margin) top = position.y + margin

  let left = position.x - menuWidth / 2
  if (left < margin) left = margin
  if (left + menuWidth > window.innerWidth - margin) {
    left = window.innerWidth - menuWidth - margin
  }

  const showCopy = !isGif && !isDeleted
  const showEdit = isMine && !isAI && !isGif && !isDeleted
  const showDelete = isMine && !isAI

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
      style={{ top, left, width: menuWidth }}
    >
      {/* Rangée emoji rapides */}
      <div className="flex items-center gap-0.5 px-1.5 py-1.5">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelectEmoji(messageId, emoji)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-xl cursor-pointer"
          >
            {emoji}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-0.5" />
        <button
          onClick={() => onOpenFullPicker(messageId)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-400 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Séparateur */}
      <div className="h-px bg-gray-100 mx-2" />

      {/* Boutons d'action */}
      <div className="grid grid-cols-4 p-1.5 gap-1">
        {/* Répondre — toujours visible */}
        <button
          onClick={() => onReply(messageId)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-600">
            <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.061.025Z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] text-gray-500">{t('chat.reply')}</span>
        </button>

        {/* Copier */}
        {showCopy ? (
          <button
            onClick={() => onCopy(messageId)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-600">
              <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
              <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
            </svg>
            <span className="text-[10px] text-gray-500">{t('chat.copy')}</span>
          </button>
        ) : (
          <div />
        )}

        {/* Modifier */}
        {showEdit ? (
          <button
            onClick={() => onEdit(messageId)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-600">
              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
            <span className="text-[10px] text-gray-500">{t('chat.edit')}</span>
          </button>
        ) : (
          <div />
        )}

        {/* Supprimer */}
        {showDelete ? (
          <button
            onClick={() => onDelete(messageId)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-500">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 3.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] text-red-500">{t('chat.delete')}</span>
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}
