import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AppointmentRow from '../../components/AppointmentRow'
import ConfirmDialog from '../../components/ConfirmDialog'
import PageHeading from '../../components/PageHeading'
import { doctorName, formatShortDay, formatTime, isUpcoming } from '../../utils/format'

const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
]

function inTab(appointment, tab, now) {
  if (tab === 'cancelled') return appointment.status === 'cancelled'
  if (tab === 'upcoming') return isUpcoming(appointment, now)
  return appointment.status !== 'cancelled' && !isUpcoming(appointment, now)
}

function MyAppointments() {
  const location = useLocation()
  const [appointments, setAppointments] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [now] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const [cancelling, setCancelling] = useState(null)
  const [cancelError, setCancelError] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    return client
      .get('/appointments/mine')
      .then((response) => setAppointments(response.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function confirmCancel() {
    setBusy(true)
    setCancelError('')
    try {
      await client.patch(`/appointments/${cancelling.id}/cancel`)
      setNotice(`Your appointment with ${doctorName(cancelling.doctor.full_name)} was cancelled.`)
      setCancelling(null)
      await load()
    } catch (err) {
      setCancelError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Upcoming soonest first; past and cancelled most recent first
  const shown = appointments.filter((appointment) => inTab(appointment, tab, now))
  if (tab !== 'upcoming') shown.reverse()

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeading
        eyebrow="Your schedule"
        title="My Appointments"
        action={
          <Link
            to="/doctors"
            className="rounded-2xl bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark"
          >
            Book a new appointment
          </Link>
        }
      />

      {notice && <Alert type="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="inline-flex rounded-full bg-mint p-1.5">
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

        {loading ? (
          <p className="mt-6 text-slate-500">Loading...</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {shown.length === 0 && (
              <p className="py-10 text-center text-slate-500">
                {tab === 'upcoming'
                  ? 'You have no upcoming appointments.'
                  : `You have no ${tab} appointments.`}
              </p>
            )}
            {shown.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                details
                actions={
                  tab === 'upcoming' && (
                    <>
                      <Link
                        to={`/appointments/${appointment.id}/reschedule`}
                        className="font-semibold text-primary hover:text-primary-dark"
                      >
                        Reschedule
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setCancelError('')
                          setCancelling(appointment)
                        }}
                        className="font-semibold text-red-600 hover:text-red-700"
                      >
                        Cancel
                      </button>
                    </>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      {cancelling && (
        <ConfirmDialog
          title="Cancel this appointment?"
          message={`${doctorName(cancelling.doctor.full_name)} on ${formatShortDay(cancelling.date)} at ${formatTime(cancelling.start_time)}. The slot will be freed for other patients.`}
          confirmLabel="Cancel appointment"
          busy={busy}
          error={cancelError}
          onConfirm={confirmCancel}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  )
}

export default MyAppointments
