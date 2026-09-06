import { Link, NavLink, Outlet } from 'react-router-dom'
import { useLang, type Lang } from '../lib/lang'

const navItems = [
  { to: '/', label: 'nav.home' },
  { to: '/plan', label: 'nav.plan' },
  { to: '/history', label: 'nav.history' },
]

const LANGS: { value: Lang; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
]

export default function Layout() {
  const { t, lang, setLang } = useLang()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-bold text-slate-900">
            Travel Companion
          </Link>
          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive
                    ? 'font-medium text-slate-900'
                    : 'text-slate-500 transition-colors hover:text-slate-900'
                }
              >
                {t(item.label)}
              </NavLink>
            ))}
            <div className="ml-2 flex items-center overflow-hidden rounded-full border border-slate-300">
              {LANGS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLang(l.value)}
                  className={`px-3 py-1 text-sm transition-colors ${
                    lang === l.value
                      ? 'bg-rose-600 font-medium text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        Travel Companion
      </footer>
    </div>
  )
}
