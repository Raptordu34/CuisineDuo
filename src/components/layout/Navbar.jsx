import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useUnreadMessages } from '../../hooks/useUnreadMessages'
import LanguageSwitcher from '../LanguageSwitcher'

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

function ShoppingCartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function ChatBubbleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
}

function UnreadBadge({ count }) {
  if (!count) return null
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const { unreadCount } = useUnreadMessages(profile)

  const initial = profile?.display_name?.charAt(0)?.toUpperCase() || '?'

  const navItems = [
    { to: '/', label: t('nav.home'), Icon: HomeIcon },
    { to: '/inventory', label: t('nav.inventory'), Icon: InventoryIcon },
    { to: '/shopping', label: t('nav.shopping'), Icon: ShoppingCartIcon },
    { to: '/recipes', label: t('nav.recipes'), Icon: BookIcon },
    { to: '/chat', label: t('nav.chat'), Icon: ChatBubbleIcon, badge: unreadCount },
  ]

  const isActive = (to) => to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <>
      {/* Mobile top bar */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="CuisineDuo" className="w-8 h-8" />
            <span className="text-lg font-bold text-gray-900">CuisineDuo</span>
          </Link>

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Link to="/profile" className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </Link>
            <button
              onClick={signOut}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer ml-1"
            >
              ✕
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="h-16 pb-[env(safe-area-inset-bottom)] flex justify-around items-center">
          {navItems.map(({ to, label, Icon, badge }) => (
            <Link
              key={to}
              to={to}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive(to) ? 'text-orange-500' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                <Icon />
                <UnreadBadge count={badge} />
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop navbar */}
      <nav className="hidden md:block bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="CuisineDuo" className="w-8 h-8" />
            <span className="text-xl font-bold text-gray-900">CuisineDuo</span>
          </Link>

          <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
            {navItems.map(({ to, label, badge }) => (
              <Link
                key={to}
                to={to}
                className={`relative hover:text-orange-500 transition-colors ${
                  isActive(to) ? 'text-orange-500' : ''
                }`}
              >
                {label}
                {badge > 0 && (
                  <span className="absolute -top-2 -right-4 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="text-sm text-gray-600">{profile?.display_name}</span>
            <Link to="/profile" className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </Link>
            <button
              onClick={signOut}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
