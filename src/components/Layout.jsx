import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Gamepad2, Radio, Trophy, Calendar, Plug, AlertTriangle, Settings } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: Gamepad2 },
  { path: '/capture', label: 'Screen Capture', icon: Radio },
  { path: '/tournaments', label: 'Tournaments', icon: Trophy },
  { path: '/matches', label: 'Matches', icon: Calendar },
  { path: '/api-destinations', label: 'API Destinations', icon: Plug },
  { path: '/violations', label: 'Violations', icon: AlertTriangle },
  { path: '/settings', label: 'Settings', icon: Settings }
]

export default function Layout() {
  const location = useLocation()
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 flex-shrink-0 border-r" style={{ borderColor: 'var(--ors-border)', background: 'var(--ors-surface)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--ors-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--ors-accent)' }}>
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold">Free Fire ORS</div>
              <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>Observer/Referee System</div>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto scroll-thin" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={`sidebar-link ${location.pathname === path ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto scroll-thin" style={{ background: 'var(--ors-bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
