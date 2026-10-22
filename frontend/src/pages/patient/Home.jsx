import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, Clock, ShieldCheck, Stethoscope } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AppointmentRow from '../../components/AppointmentRow'
import { useAuth } from '../../context/AuthContext'
import {
  appointmentStart,
  doctorName,
  firstName,
  formatLongDate,
  formatTime,
  formatTimeUntil,
  fromDateKey,
  isUpcoming,
} from '../../utils/format'

// How many upcoming appointments the home page lists before "View all"
const HOME_LIST_SIZE = 3

function ServiceCard({ to, icon: Icon, title, text }) {
  return (
    <Link
      to={to}
      className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-primary">
          <Icon size={26} />
        </span>
        <ArrowRight size={20} className="text-primary transition group-hover:translate-x-1" />
      </div>
      <p className="mt-6 text-lg font-bold text-primary-dark">{title}</p>
      <p className="mt-1 text-slate-500">{text}</p>
    </Link>
  )
}

// Counts down to the next appointment, refreshing every 30 seconds
function NextAppointmentCard({ appointment }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  if (!appointment) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
          Next appointment
        </p>
        <p className="mt-4 text-slate-500">You have no upcoming appointments.</p>
        <Link
          to="/doctors"
          className="mt-5 inline-block rounded-2xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-dark"
        >
          Find a doctor
        </Link>
      </section>
    )
  }

  const day = fromDateKey(appointment.date)
  const isHome = appointment.consultation_type === 'home'

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
        Next appointment
      </p>
      <div className="mt-5 inline-flex flex-col items-center rounded-2xl bg-mint px-5 py-3 text-primary-dark">
        <span className="text-3xl font-bold">{day.getDate()}</span>
        <span className="text-xs font-semibold uppercase">
          {day.toLocaleDateString('en-GB', { month: 'short' })}
        </span>
      </div>
      <p className="mt-5 text-2xl font-bold text-primary-dark">
        {doctorName(appointment.doctor.full_name)}
      </p>
      <p className="mt-1 text-lg text-slate-500">
        {appointment.doctor.specialty} · {appointment.doctor.area}
      </p>
      <p className="mt-1 text-slate-500">
        {formatTime(appointment.start_time)} · {isHome ? 'Home visit' : 'In-clinic visit'}
      </p>
      <div className="mt-5 flex items-center gap-4 rounded-2xl bg-page p-4">
        <Clock size={24} className="text-primary" />
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Starts in</p>
          <p className="font-bold text-slate-800">
            {formatTimeUntil(appointmentStart(appointment), now)}
          </p>
        </div>
      </div>
    </section>
  )
}

function Home() {
  const { user } = useAuth()
  const [now] = useState(() => new Date())
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    client
      .get('/appointments/mine')
      .then((response) => setAppointments(response.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  // The API returns appointments in date order, so the first upcoming one is the next one
  const upcoming = appointments.filter((appointment) => isUpcoming(appointment, now))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
            {formatLongDate(now)}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-primary-dark">
            Assalam-o-Alaikum, {firstName(user.full_name)}
          </h1>
          <p className="mt-3 text-lg text-slate-500">How can we help you feel better today?</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-mint px-4 py-2 font-semibold text-primary-dark">
          <ShieldCheck size={18} /> All doctors admin approved
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <ServiceCard
          to="/doctors"
          icon={Stethoscope}
          title="Find Doctor"
          text="Book approved specialists"
        />
        <ServiceCard
          to="/appointments"
          icon={CalendarCheck}
          title="My Appointments"
          text={
            loading
              ? 'Your bookings'
              : `${upcoming.length} upcoming ${upcoming.length === 1 ? 'visit' : 'visits'}`
          }
        />
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_24rem]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
            Your schedule
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-primary-dark">
            My Appointments
          </h2>
          <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {!loading && upcoming.length === 0 && (
              <p className="py-8 text-slate-500">
                No upcoming appointments.{' '}
                <Link to="/doctors" className="font-semibold text-primary hover:text-primary-dark">
                  Find a doctor
                </Link>
              </p>
            )}
            {upcoming.slice(0, HOME_LIST_SIZE).map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                actions={
                  <Link
                    to={`/appointments/${appointment.id}/reschedule`}
                    className="text-lg font-semibold text-primary hover:text-primary-dark"
                  >
                    Reschedule
                  </Link>
                }
              />
            ))}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-5 text-center">
            <Link
              to="/appointments"
              className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary-dark"
            >
              View all appointments <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {!loading && <NextAppointmentCard appointment={upcoming[0]} />}
      </div>
    </div>
  )
}

export default Home
