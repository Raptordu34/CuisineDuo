import { useState, useCallback, useRef, useEffect } from 'react'
import { useMiam } from '../../contexts/MiamContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDictation } from '../../hooks/useDictation'
import { useAudioWaveform } from '../../hooks/useAudioWaveform'

const FAB_SIZE = 56 // w-14 = 56px
const DRAG_THRESHOLD = 10 // px avant de considerer un drag
const LONG_PRESS_DELAY = 400 // ms
const LS_KEY = 'miam-fab-position'

const DEFAULT_POS = { right: 16, bottom: 80 }

function loadPosition() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const pos = JSON.parse(raw)
      if (typeof pos.right === 'number' && typeof pos.bottom === 'number') {
        return clampPosition(pos)
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_POS
}

function savePosition(pos) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(pos))
  } catch { /* ignore */ }
}

function clampPosition({ right, bottom }) {
  const maxRight = window.innerWidth - FAB_SIZE
  const maxBottom = window.innerHeight - FAB_SIZE
  return {
    right: Math.max(0, Math.min(maxRight, right)),
    bottom: Math.max(0, Math.min(maxBottom, bottom)),
  }
}

function MiamIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  )
}

function WaveformBars({ frequencyData }) {
  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {frequencyData.map((value, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-indigo-500"
          style={{
            height: `${Math.max(3, value * 32)}px`,
            transition: 'height 0.05s ease-out',
          }}
        />
      ))}
    </div>
  )
}

export default function MiamFAB() {
  const { isSheetOpen, openSheet, sendMessage, setIsVoiceActive } = useMiam()
  const { t, lang } = useLanguage()
  const { isListening, transcript, startListening, stopListening, isSupported } = useDictation()
  const { frequencyData, start: startWaveform, stop: stopWaveform } = useAudioWaveform()

  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState(loadPosition)

  const transcriptRef = useRef('')
  const langRef = useRef(lang)

  // Refs pour la gestion des gestes (drag vs long-press vs click)
  const gestureRef = useRef('idle') // 'idle' | 'pending' | 'dragging' | 'voice'
  const startClientRef = useRef({ x: 0, y: 0 })
  const startPosRef = useRef({ right: 0, bottom: 0 })
  const longPressTimerRef = useRef(null)
  const buttonRef = useRef(null)
  const pointerIdRef = useRef(null)

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  // Reclamper au resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleDictationResult = useCallback((finalTranscript) => {
    if (finalTranscript.trim()) {
      setIsVoiceActive(false)
      setIsVoiceMode(false)
      openSheet()
      sendMessage(finalTranscript.trim())
    } else {
      setIsVoiceActive(false)
      setIsVoiceMode(false)
    }
  }, [openSheet, sendMessage, setIsVoiceActive])

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    gestureRef.current = 'pending'
    startClientRef.current = { x: e.clientX, y: e.clientY }
    startPosRef.current = { ...position }
    pointerIdRef.current = e.pointerId

    // Timer pour le long press → mode voix
    longPressTimerRef.current = setTimeout(() => {
      if (gestureRef.current !== 'pending') return
      gestureRef.current = 'voice'
      if (!isSupported) {
        openSheet()
        return
      }
      setIsVoiceMode(true)
      setIsVoiceActive(true)
      transcriptRef.current = ''
      startListening(langRef.current)
      startWaveform()
    }, LONG_PRESS_DELAY)
  }, [position, isSupported, openSheet, setIsVoiceActive, startListening, startWaveform])

  const onPointerMove = useCallback((e) => {
    if (gestureRef.current === 'idle' || gestureRef.current === 'voice') return

    const dx = e.clientX - startClientRef.current.x
    const dy = e.clientY - startClientRef.current.y

    if (gestureRef.current === 'pending') {
      // Verifier si on depasse le seuil de drag
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        cancelLongPress()
        gestureRef.current = 'dragging'
        setIsDragging(true)
        // Capturer le pointeur sur le bouton pour maintenir le drag hors du bouton
        if (buttonRef.current && pointerIdRef.current != null) {
          try { buttonRef.current.setPointerCapture(pointerIdRef.current) } catch { /* ignore */ }
        }
      }
      return
    }

    if (gestureRef.current === 'dragging') {
      // Deplacement : right diminue quand on va vers la droite, bottom diminue quand on va vers le bas
      const newPos = clampPosition({
        right: startPosRef.current.right - dx,
        bottom: startPosRef.current.bottom - dy,
      })
      setPosition(newPos)
    }
  }, [cancelLongPress])

  const onPointerUp = useCallback(() => {
    const gesture = gestureRef.current
    cancelLongPress()
    gestureRef.current = 'idle'
    pointerIdRef.current = null

    if (gesture === 'dragging') {
      // Fin du drag → sauvegarder la position
      setIsDragging(false)
      setPosition(prev => {
        savePosition(prev)
        return prev
      })
      return
    }

    if (gesture === 'voice') {
      // Fin du long press → arreter la dictee
      if (isListening) {
        stopListening()
        stopWaveform()
        setTimeout(() => {
          handleDictationResult(transcriptRef.current)
        }, 300)
      }
      return
    }

    if (gesture === 'pending') {
      // Click court → ouvrir le sheet
      openSheet()
    }
  }, [cancelLongPress, isListening, stopListening, stopWaveform, handleDictationResult, openSheet])

  const onPointerCancel = useCallback(() => {
    cancelLongPress()
    if (gestureRef.current === 'dragging') {
      setIsDragging(false)
    }
    gestureRef.current = 'idle'
    pointerIdRef.current = null
  }, [cancelLongPress])

  const onContextMenu = useCallback((e) => {
    e.preventDefault()
  }, [])

  if (isSheetOpen) return null

  // Determiner si la bulle doit aller a gauche ou a droite du FAB
  const fabCenterX = window.innerWidth - position.right - FAB_SIZE / 2
  const bubbleOnLeft = fabCenterX > window.innerWidth / 2

  return (
    <>
      <button
        ref={buttonRef}
        title={t('miam.fab.tooltip')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContextMenu}
        className={`fixed z-40
          w-14 h-14 rounded-full
          text-white shadow-lg
          flex items-center justify-center
          cursor-pointer touch-none select-none
          ${isDragging
            ? 'scale-105 opacity-80'
            : isVoiceMode
              ? 'bg-red-500 shadow-red-500/30 scale-110 animate-pulse'
              : 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 shadow-indigo-500/30'
          }
          ${!isDragging && !isVoiceMode ? 'transition-all duration-200 ease-out' : ''}
        `}
        style={{
          right: `${position.right}px`,
          bottom: `${position.bottom}px`,
          ...(isDragging ? { transition: 'none', backgroundColor: '#6366f1' } : {}),
        }}
      >
        <span className="pointer-events-none">
          {isVoiceMode ? <MicIcon /> : <MiamIcon />}
        </span>
      </button>

      {/* Bulle vocale avec waveform + transcript */}
      {isVoiceMode && (
        <div
          className="fixed z-40 max-w-[70vw]"
          style={{
            bottom: `${position.bottom + FAB_SIZE + 8}px`,
            ...(bubbleOnLeft
              ? { right: `${position.right}px` }
              : { left: `${window.innerWidth - position.right - FAB_SIZE}px` }
            ),
          }}
        >
          <div className="bg-white rounded-xl shadow-lg px-3 py-2 border border-indigo-200">
            <WaveformBars frequencyData={frequencyData} />
            {transcript && (
              <p className="mt-1.5 text-sm text-gray-700 text-center">{transcript}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
