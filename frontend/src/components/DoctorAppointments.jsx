import { useEffect, useState } from 'react'
import { House, Stethoscope } from 'lucide-react'
import client, { getErrorMessage } from '../api/client'
import {
  appointmentStart,
  formatShortDay,
  formatTime,
  mondayIndex,
  toDateKey,
} from '../utils/format'
import Alert from './Alert'
import StatCard from './StatCard'
import StatusBadge from './StatusBadge'

const TABS = [
  { value: 'upcoming', label: 'Today and upcoming' },
  { value: 'earlier', label: 'Earlier' },
]

function AppointmentItem({ appointment, now, busy, onComplete }) {
  const isHome = appointment.consultation_type === 'home'
  const Icon = isHome ? House : Stethoscope
  // A visit can only be marked done once it has started
  const canComplete = appointment.status === 'confirmed' && appointmentStart(appointment) <= now

  return (
    <div className="flex flex-wrap items-start gap-4 py-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-primary">
        <Icon size={22} />
      </span>
      <div className="min-w-48 flex-1">
        <p className="text-lg font-semibold text-slate-800">{appointment.patient.full_name}</p>
        <p className="text-slate-500">
          {formatShortDay(appointment.date)} · {formatTime(appointment.start_time)} -{' '}
          {formatTime(appointment.end_time)} · {isHome ? 'Home visit' : 'In-clinic'}
        </p>
        {isHome && (
          <p className="mt-1 text-sm text-slate-500">Address: {appointment.home_address}</p>
        )}
        {appointment.patient_note && (
          <p className="mt-1 text-sm text-slate-500">Patient note: {appointment.patient_note}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <StatusBadge status={appointment.status} />
        {canComplete && (
          <button
            type="button"
            onClick={() => onComplete(appointment)}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            Mark completed
          </button>
        )}
      </div>
    </div>
  )
}

// Stat cards and appointment list on the doctor's home page
function DoctorAppointments() {
  const [appointments, setAppointments] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [now] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    client
      .get('/doctor/appointments')
      .then((response) => setAppointments(response.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function markCompleted(appointment) {
    setError('')
    setBusyId(appointment.id)
    try {
      const response = await client.patch(`/doctor/appointments/${appointment.id}`, {
        status: 'completed',
      })
      setAppointments((current) =>
        current.map((item) => (item.id === appointment.id ? response.data : item)),
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const today = toDateKey(now)
  const monday = new Date(now)
  monday.setDate(now.getDate() - mondayIndex(now))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  // Date keys are "YYYY-MM-DD", so comparing them as text also compares the dates
  const active = appointments.filter((item) => item.status !== 'cancelled')
  const todays = active.filter((item) => item.date === today)
  const thisWeek = active.filter(
    (item) => item.date >= toDateKey(monday) && item.date <= toDateKey(sunday),
  )
  const upcoming = active.filter(
    (item) => item.status === 'confirmed' && appointmentStart(item) > now,
  )

  const shown = appointments.filter((item) =>
    tab === 'upcoming' ? item.date >= today : item.date < today,
  )
  if (tab === 'earlier') shown.reverse()

  if (loading) return <p className="text-slate-500">Loading appointments...</p>

  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          label="Today's appointments"
          value={todays.length}
          note={`${todays.filter((item) => item.status === 'completed').length} completed`}
        />
        <StatCard label="This week" value={thisWeek.length} note="Monday to Sunday" />
        <StatCard
          label="Upcoming"
          value={upcoming.length}
          note={
            upcoming.length > 0
              ? `Next: ${formatShortDay(upcoming[0].date)}, ${formatTime(upcoming[0].start_time)}`
              : 'None booked yet'
          }
        />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
              Your schedule
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-primary-dark">
              Appointments
            </h2>
          </div>
          <div className="flex rounded-full bg-mint p-1.5">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`rounded-full px-5 py-2.5 font-semibold transition ${
                  tab === item.value
                    ? 'bg-white text-primary-dark shadow-sm'
                    : 'text-slate-500 hover:text-primary-dark'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-2 divide-y divide-slate-100">
          {shown.length === 0 && (
            <p className="py-10 text-center text-slate-500">
              {tab === 'upcoming'
                ? 'No appointments booked yet.'
                : 'No appointments in the past week.'}
            </p>
          )}
          {shown.map((appointment) => (
            <AppointmentItem
              key={appointment.id}
              appointment={appointment}
              now={now}
              busy={busyId === appointment.id}
              onComplete={markCompleted}
            />
          ))}
        </div>
      </section>
    </>
  )
}

export default DoctorAppointments
