import { useLanguage } from '../../contexts/LanguageContext'

export default function SwipeWaitingState({ membersProgress }) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />

      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white">{t('swipe.waitingTitle')}</h2>
        <p className="text-sm text-gray-400">{t('swipe.waitingDesc')}</p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {membersProgress.map((member) => {
          const pct = member.totalCount > 0
            ? Math.round((member.votedCount / member.totalCount) * 100)
            : 0
          const done = member.votedCount >= member.totalCount && member.totalCount > 0

          return (
            <div key={member.profileId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className={done ? 'text-green-400 font-medium' : 'text-gray-300'}>
                  {member.displayName}
                  {done && ' ✓'}
                </span>
                <span className="text-gray-500 text-xs">
                  {member.votedCount}/{member.totalCount}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-orange-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
