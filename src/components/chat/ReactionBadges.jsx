export default function ReactionBadges({ reactions, onTapReaction, isMine }) {
  const entries = Object.entries(reactions)
  if (entries.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 mt-0.5 ${isMine ? 'justify-end mr-1' : 'ml-1'}`}>
      {entries.map(([emoji, { count, profiles, reactedByMe }]) => (
        <button
          key={emoji}
          onClick={() => onTapReaction(emoji)}
          title={profiles.join(', ')}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
            reactedByMe
              ? 'bg-orange-100 border border-orange-300 text-orange-700'
              : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="text-[10px] font-medium">{count}</span>}
        </button>
      ))}
    </div>
  )
}
