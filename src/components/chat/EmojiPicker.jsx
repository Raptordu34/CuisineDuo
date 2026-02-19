import { useRef } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

const EMOJI_CATEGORIES = [
  {
    key: 'smileys',
    label: { fr: 'Smileys', en: 'Smileys', zh: 'Smileys' },
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋',
      '😜', '🤪', '😝', '🤗', '🤔', '🫡', '🤫', '😏',
      '😌', '😴', '🤤', '😷', '🤒', '🥳', '🤠', '😎',
    ],
  },
  {
    key: 'gestures',
    label: { fr: 'Gestes', en: 'Gestures', zh: 'Gestures' },
    emojis: [
      '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️',
      '🤞', '🤟', '🤙', '👋', '🫶', '❤️', '🔥', '⭐',
      '✨', '💯', '🎉', '🎊', '👀', '💀', '☠️', '🫠',
    ],
  },
  {
    key: 'emotions',
    label: { fr: 'Emotions', en: 'Emotions', zh: 'Emotions' },
    emojis: [
      '😢', '😭', '😤', '😡', '🤬', '😱', '😨', '😰',
      '😥', '😓', '🤯', '😮', '😲', '🥺', '😣', '😖',
      '😩', '😫', '🥱', '😶', '🫣', '🫢', '🤭', '😑',
    ],
  },
  {
    key: 'food',
    label: { fr: 'Nourriture', en: 'Food', zh: 'Food' },
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🧀', '🥚', '🍳',
      '🥞', '🧇', '🥩', '🍗', '🍖', '🌮', '🌯', '🥗',
      '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍰',
      '🎂', '🍩', '🍪', '🍫', '🍬', '☕', '🍷', '🍺',
    ],
  },
]

export default function EmojiPicker({ messageId, onSelectEmoji, onClose }) {
  const { lang } = useLanguage()
  const scrollRef = useRef(null)
  const sectionRefs = useRef({})

  const scrollToCategory = (key) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Bottom sheet */}
      <div
        className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl flex flex-col"
        style={{ height: '50vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-semibold text-gray-700">
            {lang === 'fr' ? 'Choisir un emoji' : lang === 'zh' ? 'Choose emoji' : 'Choose emoji'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Category tabs — scroll vers la section */}
        <div className="flex gap-1 px-3 py-2 border-b border-gray-100 shrink-0">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => scrollToCategory(cat.key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer bg-gray-50 text-gray-500 hover:bg-gray-100 active:bg-orange-100 active:text-orange-700"
            >
              {cat.label[lang] || cat.label.fr}
            </button>
          ))}
        </div>

        {/* Emoji grid — toutes les categories en scroll continu */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain p-3 pb-6 min-h-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.key} ref={(el) => { sectionRefs.current[cat.key] = el }}>
              <p className="text-xs font-medium text-gray-400 mb-1.5 mt-2 first:mt-0">
                {cat.label[lang] || cat.label.fr}
              </p>
              <div className="grid grid-cols-8 gap-1">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onSelectEmoji(messageId, emoji)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-2xl cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
