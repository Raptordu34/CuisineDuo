import { useRef, useCallback } from 'react'

export function useLongPress(callback, { delay = 500, threshold = 10 } = {}) {
  const longPressTimer = useRef(null)
  const didLongPress = useRef(false)
  const pointerStart = useRef(null)

  const cancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const onPointerDown = useCallback((e) => {
    didLongPress.current = false
    // Capturer les valeurs avant le timeout car React recycle les evenements synthetiques
    const clientX = e.clientX
    const clientY = e.clientY
    const currentTarget = e.currentTarget
    pointerStart.current = { x: clientX, y: clientY }
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      callback({ currentTarget, clientX, clientY })
    }, delay)
  }, [callback, delay])

  const onPointerMove = useCallback((e) => {
    if (!pointerStart.current || !longPressTimer.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      cancel()
    }
  }, [cancel, threshold])

  const onPointerUp = useCallback(() => {
    cancel()
    pointerStart.current = null
  }, [cancel])

  const onPointerLeave = useCallback(() => {
    cancel()
    pointerStart.current = null
  }, [cancel])

  const onClick = useCallback((e) => {
    if (didLongPress.current) {
      didLongPress.current = false
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  const onContextMenu = useCallback((e) => {
    if (longPressTimer.current || didLongPress.current) {
      e.preventDefault()
    }
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onClick, onContextMenu }
}
