import { useState } from 'react'

const SIZES = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
}

export default function StarRatingInline({ value, onChange, size = 'sm', disabled = false }) {
  const [hovered, setHovered] = useState(null)
  const starSize = SIZES[size] || SIZES.sm

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (!disabled && onChange) onChange(star)
          }}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          disabled={disabled}
          className="cursor-pointer p-0 transition-transform hover:scale-110 disabled:opacity-50 bg-transparent border-none"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={star <= (hovered || value || 0) ? '#f59e0b' : '#e5e7eb'}
            className={`${starSize} transition-colors`}
          >
            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
          </svg>
        </button>
      ))}
      {value > 0 && size === 'md' && (
        <span className="text-xs text-gray-400 ml-1">{value}/5</span>
      )}
    </div>
  )
}
