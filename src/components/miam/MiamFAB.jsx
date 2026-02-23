import { useLocation } from 'react-router-dom'
import { useMiam } from '../../contexts/MiamContext'
import { useLanguage } from '../../contexts/LanguageContext'

function MiamIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}

// Pages ou le FAB chevaucherait des elements interactifs fixes en bas
const HIDDEN_ROUTES = ['/chat']

export default function MiamFAB() {
  const { isSheetOpen, openSheet } = useMiam()
  const { t } = useLanguage()
  const { pathname } = useLocation()

  if (isSheetOpen || HIDDEN_ROUTES.includes(pathname)) return null

  return (
    <button
      title={t('miam.fab.tooltip')}
      onClick={openSheet}
      className="fixed z-40 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6
        w-14 h-14 rounded-full
        bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700
        text-white shadow-lg shadow-indigo-500/30
        flex items-center justify-center
        cursor-pointer transition-all duration-200 ease-out"
    >
      <MiamIcon />
    </button>
  )
}
