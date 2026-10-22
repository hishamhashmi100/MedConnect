import { CalendarCheck, CalendarClock, LayoutGrid, Stethoscope, UserRound } from 'lucide-react'

// Sidebar links for each role. "end" means the link is only active on that exact path,
// so Home is not highlighted on every page below it.
const NAV_ITEMS = {
  patient: [
    { to: '/', label: 'Home', icon: LayoutGrid, end: true },
    { to: '/doctors', label: 'Doctors', icon: Stethoscope },
    { to: '/appointments', label: 'My Appointments', icon: CalendarCheck },
  ],
  doctor: [
    { to: '/doctor', label: 'Home', icon: LayoutGrid, end: true },
    { to: '/doctor/profile', label: 'Profile', icon: UserRound },
    { to: '/doctor/availability', label: 'Availability', icon: CalendarClock },
  ],
  admin: [{ to: '/admin', label: 'Overview', icon: LayoutGrid, end: true }],
}

// The link that matches the current page, used for the top bar title
export function currentNavItem(role, pathname) {
  return NAV_ITEMS[role].find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )
}

export default NAV_ITEMS
