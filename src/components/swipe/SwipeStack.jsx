import { useRef, useCallback, useState } from 'react'
import SwipeCard from './SwipeCard'

const SWIPE_THRESHOLD = 100

export default function SwipeStack({ recipes, onVote }) {
  const [dragState, setDragState] = useState({ x: 0, y: 0, dragging: false })
  const startPos = useRef(null)

  const currentRecipe = recipes[0]
  const nextRecipe = recipes[1]

  const handleVote = useCallback((liked) => {
    if (!currentRecipe) return
    onVote(currentRecipe.id, liked)
    setDragState({ x: 0, y: 0, dragging: false })
  }, [currentRecipe, onVote])

  const onPointerDown = useCallback((e) => {
    startPos.current = { x: e.clientX, y: e.clientY }
    setDragState(prev => ({ ...prev, dragging: true }))
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!startPos.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    setDragState({ x: dx, y: dy, dragging: true })
  }, [])

  const onPointerUp = useCallback(() => {
    if (!startPos.current) return
    const { x } = dragState

    if (x > SWIPE_THRESHOLD) {
      handleVote(true)
    } else if (x < -SWIPE_THRESHOLD) {
      handleVote(false)
    } else {
      setDragState({ x: 0, y: 0, dragging: false })
    }
    startPos.current = null
  }, [dragState, handleVote])

  if (!currentRecipe) return null

  const rotation = dragState.x * 0.08
  const opacity = Math.max(0, 1 - Math.abs(dragState.x) / 400)

  const overlay = dragState.dragging
    ? dragState.x > 40
      ? 'like'
      : dragState.x < -40
        ? 'nope'
        : null
    : null

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '3/4' }}>
      {/* Next card (behind) */}
      {nextRecipe && (
        <SwipeCard
          recipe={nextRecipe}
          style={{ transform: 'scale(0.95)', opacity: 0.5 }}
        />
      )}

      {/* Current card */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={dragState.dragging ? onPointerMove : undefined}
        onPointerUp={onPointerUp}
        onPointerLeave={dragState.dragging ? onPointerUp : undefined}
        style={{ touchAction: 'none' }}
        className="absolute inset-0"
      >
        <SwipeCard
          recipe={currentRecipe}
          overlay={overlay}
          style={{
            transform: `translateX(${dragState.x}px) translateY(${dragState.y * 0.3}px) rotate(${rotation}deg)`,
            opacity,
            transition: dragState.dragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
            cursor: 'grab',
          }}
        />
      </div>
    </div>
  )
}
