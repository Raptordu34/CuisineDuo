import { useEffect, useRef } from 'react'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export default function ReactionBar({ messageId, position, onSelectEmoji, onOpenFullPicker, onClose }) {
  const barRef = useRef(null)

  // Positionner la barre et fermer au clic exterieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        onClose()
      }
    }
    // Petit delai pour ne pas capturer l'evenement d'appui long lui-meme
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [onClose])

  // Calculer la position (au-dessus ou en-dessous selon l'espace disponible)
  const barWidth = 280
  const barHeight = 44
  const margin = 8

  let top = position.y - barHeight - margin
  if (top < margin) top = position.y + margin

  let left = position.x - barWidth / 2
  if (left < margin) left = margin
  if (left + barWidth > window.innerWidth - margin) {
    left = window.innerWidth - barWidth - margin
  }

  return (
    <div
      ref={barRef}
      className="fixed z-50 flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-gray-200 px-1.5 py-1 animate-in fade-in zoom-in-95 duration-150"
      style={{ top, left }}
    >
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
  )
}
