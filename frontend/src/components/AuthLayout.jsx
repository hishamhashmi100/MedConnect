import { useEffect, useState } from 'react'
import {
  CalendarCheck,
  CalendarClock,
  HeartPlus,
  House,
  Plus,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'
import Logo from './Logo'

const SLIDES = [
  {
    icon: Stethoscope,
    title: 'Book Doctors',
    text: 'Approved specialists with real, open time slots',
  },
  {
    icon: ShieldCheck,
    title: 'Verified Doctors',
    text: 'Every PMDC number is checked by our admin team',
  },
  {
    icon: House,
    title: 'Clinic or Home Visit',
    text: 'See the doctor at the clinic or book a visit at home',
  },
  {
    icon: CalendarClock,
    title: 'Your Schedule',
    text: 'Reschedule or cancel upcoming visits in a few clicks',
  },
]

const SLIDE_SECONDS = 5

function AuthLayout({ children }) {
  const [active, setActive] = useState(0)
  const slide = SLIDES[active]
  const SlideIcon = slide.icon

  // A timeout keyed on the slide means clicking a dot also restarts the timer
  useEffect(() => {
    const timer = setTimeout(() => setActive((active + 1) % SLIDES.length), SLIDE_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [active])

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[57%] flex-col overflow-hidden bg-linear-to-br from-primary to-teal-soft p-12 text-white lg:flex">
        <div className="absolute top-32 -right-28 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-40 -left-28 h-[28rem] w-[28rem] rounded-full bg-white/10" />

        <div className="relative flex items-center justify-between">
          <Logo light />
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-primary-dark">
            Karachi Pilot Hub
          </span>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative h-80 w-80">
            <div className="absolute inset-0 rounded-full border border-white/30" />
            <div className="absolute inset-12 rounded-full border border-dashed border-white/25" />
            <div className="absolute inset-x-[5.5rem] inset-y-[4.5rem] flex items-center justify-center rounded-t-[4.5rem] rounded-b-[2rem] bg-linear-to-b from-white to-mint text-primary shadow-2xl">
              <SlideIcon size={52} strokeWidth={1.75} />
            </div>
            <div className="absolute top-8 -left-6 flex h-24 w-24 -rotate-6 items-center justify-center rounded-3xl bg-white/90 text-primary shadow-xl">
              <HeartPlus size={40} strokeWidth={1.75} />
            </div>
            <div className="absolute -right-4 bottom-6 flex h-20 w-20 rotate-12 items-center justify-center rounded-3xl bg-white/90 text-primary shadow-xl">
              <CalendarCheck size={32} strokeWidth={1.75} />
            </div>
            <Plus className="absolute top-14 right-6" size={28} />
          </div>

          <h2 className="mt-10 text-3xl font-bold tracking-tight">{slide.title}</h2>
          <p className="mt-3 text-lg text-white/85">{slide.text}</p>

          <div className="mt-8 flex gap-2">
            {SLIDES.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Show slide ${index + 1}`}
                onClick={() => setActive(index)}
                className={`h-2 rounded-full transition-all ${
                  index === active ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-lg">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
