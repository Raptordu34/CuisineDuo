import { useState, useCallback, useRef, useEffect } from 'react'
import { useMiam } from '../../contexts/MiamContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useLongPress } from '../../hooks/useLongPress'
import { useDictation } from '../../hooks/useDictation'

// Keep lang fresh via ref to avoid stale closures in useLongPress timeout

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

export default function MiamFAB() {
  const { isSheetOpen, openSheet, sendMessage, setIsVoiceActive } = useMiam()
  const { t, lang } = useLanguage()
  const { isListening, transcript, startListening, stopListening, isSupported } = useDictation()
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const transcriptRef = useRef('')
  const langRef = useRef(lang)

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  // Use the DictationButton's pattern: track transcript via ref, send on result
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

  // Track transcript for display
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  const handleLongPress = useCallback(() => {
    if (!isSupported) {
      openSheet()
      return
    }
    setIsVoiceMode(true)
    setIsVoiceActive(true)
    transcriptRef.current = ''
    startListening(langRef.current)
  }, [isSupported, openSheet, setIsVoiceActive, startListening])

  const longPressProps = useLongPress(handleLongPress, { delay: 400 })

  const handlePointerUp = useCallback(() => {
    longPressProps.onPointerUp()
    if (isVoiceMode && isListening) {
      stopListening()
      // After stopping, use a small delay for final result
      setTimeout(() => {
        const text = transcriptRef.current
        handleDictationResult(text)
      }, 300)
    }
  }, [longPressProps, isVoiceMode, isListening, stopListening, handleDictationResult])

  const handleClick = useCallback((e) => {
    longPressProps.onClick(e)
    if (!e.defaultPrevented) {
      openSheet()
    }
  }, [longPressProps, openSheet])

  if (isSheetOpen) return null

  return (
    <>
      <button
        title={t('miam.fab.tooltip')}
        onClick={handleClick}
        onPointerDown={longPressProps.onPointerDown}
        onPointerMove={longPressProps.onPointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={longPressProps.onPointerLeave}
        onContextMenu={longPressProps.onContextMenu}
        className={`fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40
          w-14 h-14 rounded-full
          text-white shadow-lg
          flex items-center justify-center
          transition-all duration-200 ease-out
          cursor-pointer touch-none
          ${isVoiceMode
            ? 'bg-red-500 shadow-red-500/30 scale-110 animate-pulse'
            : 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 shadow-indigo-500/30'
          }`}
      >
        {isVoiceMode ? <MicIcon /> : <MiamIcon />}
      </button>

      {/* Voice transcript bubble */}
      {isVoiceMode && transcript && (
        <div className="fixed bottom-36 right-4 md:bottom-24 md:right-8 z-40 max-w-[70vw]">
          <div className="bg-white rounded-xl shadow-lg px-3 py-2 text-sm text-gray-700 border border-indigo-200">
            {transcript}
          </div>
        </div>
      )}
    </>
  )
}
