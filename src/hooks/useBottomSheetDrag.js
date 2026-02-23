import { useState, useRef, useCallback, useEffect } from 'react'

// Snap points en vh
const SNAP_MINI = 30
const SNAP_MEDIUM = 60
const SNAP_FULL = 95
const SNAP_POINTS = [SNAP_MINI, SNAP_MEDIUM, SNAP_FULL]

const INITIAL_HEIGHT = 80
const FLICK_VELOCITY_THRESHOLD = 1500 // px/s
const CLOSE_THRESHOLD = 20 // vh — si on descend sous ce seuil, on ferme

function vhToPx(vh) {
  return (vh / 100) * window.innerHeight
}

function pxToVh(px) {
  return (px / window.innerHeight) * 100
}

function closestSnap(vh) {
  let closest = SNAP_POINTS[0]
  let minDist = Math.abs(vh - closest)
  for (let i = 1; i < SNAP_POINTS.length; i++) {
    const dist = Math.abs(vh - SNAP_POINTS[i])
    if (dist < minDist) {
      minDist = dist
      closest = SNAP_POINTS[i]
    }
  }
  return closest
}

export function useBottomSheetDrag({ onClose }) {
  const [heightVh, setHeightVh] = useState(INITIAL_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)

  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightPxRef = useRef(0)
  const lastYRef = useRef(0)
  const lastTimeRef = useRef(0)
  const velocityRef = useRef(0)

  const resetHeight = useCallback(() => {
    setHeightVh(INITIAL_HEIGHT)
  }, [])

  const snapTo = useCallback((targetVh) => {
    setHeightVh(targetVh)
    setIsDragging(false)
  }, [])

  const onHandlePointerDown = useCallback((e) => {
    e.preventDefault()
    draggingRef.current = true
    setIsDragging(true)
    startYRef.current = e.clientY
    startHeightPxRef.current = vhToPx(heightVh)
    lastYRef.current = e.clientY
    lastTimeRef.current = Date.now()
    velocityRef.current = 0

    // Capturer le pointeur pour maintenir le drag
    if (e.target.setPointerCapture) {
      e.target.setPointerCapture(e.pointerId)
    }
  }, [heightVh])

  const onHandlePointerMove = useCallback((e) => {
    if (!draggingRef.current) return
    e.preventDefault()

    const now = Date.now()
    const dt = now - lastTimeRef.current
    if (dt > 0) {
      velocityRef.current = (e.clientY - lastYRef.current) / dt * 1000 // px/s, positif = vers le bas
    }
    lastYRef.current = e.clientY
    lastTimeRef.current = now

    // deltaY negatif = vers le haut (plus grand), positif = vers le bas (plus petit)
    const deltaY = startYRef.current - e.clientY
    const newHeightPx = startHeightPxRef.current + deltaY
    const newHeightVh = Math.max(10, Math.min(SNAP_FULL, pxToVh(newHeightPx)))

    setHeightVh(newHeightVh)
  }, [])

  const onHandlePointerUp = useCallback((e) => {
    if (!draggingRef.current) return
    e.preventDefault()
    draggingRef.current = false

    const currentVh = pxToVh(startHeightPxRef.current + (startYRef.current - e.clientY))
    const velocity = velocityRef.current // positif = vers le bas

    // Flick rapide vers le bas → fermer ou snap mini
    if (velocity > FLICK_VELOCITY_THRESHOLD) {
      if (currentVh < SNAP_MINI) {
        setIsDragging(false)
        onClose?.()
        return
      }
      // Trouver le snap immediatement inferieur
      const lowerSnaps = SNAP_POINTS.filter(s => s < currentVh)
      if (lowerSnaps.length > 0) {
        snapTo(lowerSnaps[lowerSnaps.length - 1])
      } else {
        setIsDragging(false)
        onClose?.()
      }
      return
    }

    // Flick rapide vers le haut → snap superieur
    if (velocity < -FLICK_VELOCITY_THRESHOLD) {
      const upperSnaps = SNAP_POINTS.filter(s => s > currentVh)
      if (upperSnaps.length > 0) {
        snapTo(upperSnaps[0])
      } else {
        snapTo(SNAP_FULL)
      }
      return
    }

    // Fermeture si trop bas
    if (currentVh < CLOSE_THRESHOLD) {
      setIsDragging(false)
      onClose?.()
      return
    }

    // Snap au point le plus proche
    snapTo(closestSnap(currentVh))
  }, [onClose, snapTo])

  // Nettoyage au demontage
  useEffect(() => {
    return () => {
      draggingRef.current = false
    }
  }, [])

  const sheetStyle = {
    height: `${heightVh}vh`,
    transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    willChange: isDragging ? 'height' : 'auto',
  }

  const handleProps = {
    onPointerDown: onHandlePointerDown,
    onPointerMove: onHandlePointerMove,
    onPointerUp: onHandlePointerUp,
    style: { touchAction: 'none', cursor: 'grab' },
  }

  return {
    sheetStyle,
    handleProps,
    resetHeight,
    isDragging,
  }
}
