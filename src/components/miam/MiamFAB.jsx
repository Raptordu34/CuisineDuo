import { useCallback } from 'react'
import { useMiam } from '../../contexts/MiamContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useLongPress } from '../../hooks/useLongPress'

function MiamIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}

export default function MiamFAB() {
  const { isSheetOpen, openSheet, startVoiceChat } = useMiam()
  const { t } = useLanguage()

  const handleLongPress = useCallback(() => {
    startVoiceChat()
  }, [startVoiceChat])

  const longPressProps = useLongPress(handleLongPress, { delay: 400 })

  const handleClick = useCallback((e) => {
    longPressProps.onClick(e)
    if (!e.defaultPrevented) {
      openSheet()
    }
  }, [longPressProps, openSheet])

  if (isSheetOpen) return null

  return (
    <>
      {/* Mobile notch dock behind FAB */}
      <div
        className="md:hidden fixed bottom-[1.75rem] left-1/2 -translate-x-1/2 z-50 w-[4.25rem] h-[4.25rem] rounded-full bg-white"
        style={{ boxShadow: '0 -1px 0 0 #e5e7eb, 0 -4px 6px -2px rgba(0,0,0,0.07)' }}
      />

      <button
        title={t('miam.fab.tooltip')}
        onClick={handleClick}
        onPointerDown={longPressProps.onPointerDown}
        onPointerMove={longPressProps.onPointerMove}
        onPointerUp={longPressProps.onPointerUp}
        onPointerLeave={longPressProps.onPointerLeave}
        onContextMenu={longPressProps.onContextMenu}
        className="fixed bottom-[2.25rem] left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 z-[51]
          w-[3.25rem] h-[3.25rem] rounded-full
          bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 shadow-indigo-500/30
          text-white shadow-lg
          flex items-center justify-center
          transition-all duration-200 ease-out
          cursor-pointer touch-none"
      >
        <MiamIcon />
      </button>
    </>
  )
}
