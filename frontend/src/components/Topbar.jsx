import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import { currentNavItem } from './navItems'

// Patients can search doctors by name or specialty from any page
function DoctorSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const text = query.trim()
    navigate(text ? `/doctors?q=${encodeURIComponent(text)}` : '/doctors')
  }

  return (
    <form onSubmit={handleSubmit} className="hidden md:block">
      <label className="flex w-80 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <Search size={20} className="text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search doctors or specialties"
          aria-label="Search doctors or specialties"
          className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
        />
      </label>
    </form>
  )
}

function Topbar({ onOpenMenu }) {
  const { user } = useAuth()
  const location = useLocation()
  const current = currentNavItem(user.role, location.pathname)

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-slate-200 bg-white/90 px-6 backdrop-blur lg:px-10">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="rounded-xl p-2 text-primary-dark hover:bg-mint lg:hidden"
      >
        <Menu size={24} />
      </button>
      <h2 className="text-2xl font-bold text-primary-dark">{current?.label}</h2>
      <div className="ml-auto flex items-center gap-4">
        {user.role === 'patient' && <DoctorSearch />}
        <Avatar name={user.full_name} />
      </div>
    </header>
  )
}

export default Topbar
