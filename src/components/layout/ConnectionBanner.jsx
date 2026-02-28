import useOnlineStatus from '../../hooks/useOnlineStatus'
import { useLanguage } from '../../contexts/LanguageContext'

export default function ConnectionBanner() {
  const connectionStatus = useOnlineStatus()
  const { t } = useLanguage()

  const config = {
    online: {
      bg: 'bg-emerald-500/60',
      dot: 'bg-white/80',
      dotAnim: '',
      text: t('offline.connected'),
    },
    slow: {
      bg: 'bg-yellow-500/70',
      dot: 'bg-white/80',
      dotAnim: 'animate-pulse',
      text: t('offline.weakConnection'),
    },
    offline: {
      bg: 'bg-gray-500/70',
      dot: 'bg-white/80',
      dotAnim: '',
      text: t('offline.banner'),
    },
  }

  const c = config[connectionStatus] || config.online

  return (
    <div className={`${c.bg} text-white/90 text-center text-[10px] py-px px-2 font-medium flex items-center justify-center gap-1 fixed top-14 left-0 right-0 z-50 md:static md:z-auto`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot} ${c.dotAnim}`} />
      {c.text}
    </div>
  )
}
