import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import SlotPicker from '../../components/SlotPicker'
import { doctorName, formatDateKey, formatTime } from '../../utils/format'

function Reschedule() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [appointment, setAppointment] = useState(null)
  const [doctor, setDoctor] = useState(null)
  const [choice, setChoice] = useState({ date: '', time: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    client
      .get('/appointments/mine')
      .then(async (response) => {
        const found = response.data.find((item) => item.id === Number(id))
        if (!found || found.status !== 'confirmed') {
          setError('This appointment cannot be rescheduled.')
          return
        }
        const doctorResponse = await client.get(`/doctors/${found.doctor.id}`)
        setAppointment(found)
        setDoctor(doctorResponse.data)
        setChoice({ date: found.date, time: '' })
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!choice.time) {
      setError('Please pick a new time slot.')
      return
    }

    setSaving(true)
    try {
      await client.patch(`/appointments/${appointment.id}/reschedule`, {
        date: choice.date,
        start_time: choice.time,
      })
      navigate('/appointments', {
        state: {
          notice: `Your appointment has been moved to ${formatDateKey(choice.date)} at ${formatTime(choice.time)}.`,
        },
      })
    } catch (err) {
      setError(getErrorMessage(err))
      if (err.response?.status === 409) {
        setChoice((current) => ({ ...current, time: '' }))
        setReloadKey((key) => key + 1)
      }
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      <Link
        to="/appointments"
        className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary-dark"
      >
        <ArrowLeft size={18} /> Back to my appointments
      </Link>

      <PageHeading eyebrow="Reschedule" title="Pick a new time" />

      {!appointment ? (
        <Alert>{error}</Alert>
      ) : (
        <>
          <div className="rounded-3xl bg-mint p-6 text-primary-dark">
            <p className="font-semibold">
              Currently booked with {doctorName(appointment.doctor.full_name)}
            </p>
            <p className="mt-1">
              {formatDateKey(appointment.date)} at {formatTime(appointment.start_time)} ·{' '}
              {appointment.consultation_type === 'clinic' ? 'In-clinic visit' : 'Home visit'}
            </p>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-bold text-primary-dark">New date and time</h2>
            <SlotPicker doctor={doctor} value={choice} onChange={setChoice} reloadKey={reloadKey} />
          </section>

          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end">
            <PrimaryButton wide={false} disabled={saving}>
              {saving ? 'Saving...' : 'Confirm new time'}
            </PrimaryButton>
          </div>
        </>
      )}
    </form>
  )
}

export default Reschedule
