import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import Logo from './Logo'
import NAV_ITEMS from './navItems'

const ROLE_LABELS = {
  patient: 'Patient account',
  doctor: 'Doctor account',
  admin: 'Admin account',
}

function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white px-5 py-8 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="px-3">
        <Logo />
      </div>

      <nav className="mt-12 flex-1 space-y-1">
        {NAV_ITEMS[user.role].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `relative flex items-center gap-4 rounded-2xl px-4 py-3.5 text-lg transition ${
                isActive
                  ? 'bg-mint font-semibold text-primary-dark before:absolute before:top-2 before:bottom-2 before:-left-5 before:w-1 before:rounded-r before:bg-primary'
                  : 'text-slate-600 hover:bg-mint/60 hover:text-primary-dark'
              }`
            }
          >
            <item.icon size={22} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3 rounded-2xl bg-page p-4">
        <Avatar name={user.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-primary-dark">{user.full_name}</p>
          <p className="text-sm text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          title="Log out"
          className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-primary-dark"
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
