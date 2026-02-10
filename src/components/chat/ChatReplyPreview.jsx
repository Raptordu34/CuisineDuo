export default function ChatReplyPreview({ replyTo, onCancel, t }) {
  if (!replyTo) return null

  const name = replyTo.is_ai ? 'Miam' : (replyTo.profiles?.display_name || '?')

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-t border-gray-200">
      <div className="w-1 h-8 bg-indigo-400 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-indigo-600">
          {t('chat.replyingTo')} {name}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {replyTo.content?.slice(0, 80)}{replyTo.content?.length > 80 ? '...' : ''}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
