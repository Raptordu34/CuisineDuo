import { useLanguage } from '../contexts/LanguageContext'

const flags = [
  { code: 'fr', label: '\ud83c\uddeb\ud83c\uddf7' },
  { code: 'en', label: '\ud83c\uddec\ud83c\udde7' },
  { code: 'zh', label: '\ud83c\udde8\ud83c\uddf3' },
]

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="flex items-center gap-1">
      {flags.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`text-xl cursor-pointer rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-opacity ${
            lang === code ? 'opacity-100 ring-2 ring-orange-400 ring-offset-1' : 'opacity-50 hover:opacity-80'
          }`}
          title={code.toUpperCase()}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
