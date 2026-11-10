import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import client, { getErrorMessage, notFoundAsNull } from '../../api/client'
import Alert from '../../components/Alert'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import SlotPicker from '../../components/SlotPicker'
import { doctorName, formatDateKey, formatFee, formatTime, isUpcoming } from '../../utils/format'
import { appointmentPlaceText, bookingPlaces, placeOfAppointment } from '../../utils/places'

function Reschedule() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [appointment, setAppointment] = useState(null)
  const [doctor, setDoctor] = useState(null)
  const [places, setPlaces] = useState([])
  const [place, setPlace] = useState(null)
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
        if (!found || !isUpcoming(found, new Date())) {
          setError('Only upcoming confirmed appointments can be rescheduled.')
          return
        }
        const doctorResponse = await client.get(`/doctors/${found.doctor.id}`).catch(notFoundAsNull)
        if (!doctorResponse) {
          setError(
            "This doctor is not taking bookings right now, so the appointment can't be moved. You can still cancel it from My Appointments.",
          )
          return
        }
        // A clinic visit can move to any of the doctor's clinics; a home visit stays a home
        // visit, since it is tied to the patient's address
        const allowed = bookingPlaces(doctorResponse.data).filter(
          (item) => item.type === found.consultation_type,
        )
        if (allowed.length === 0) {
          setError(
            "The doctor no longer takes this kind of booking, so the appointment can't be moved. You can still cancel it from My Appointments.",
          )
          return
        }
        setAppointment(found)
        setDoctor(doctorResponse.data)
        setPlaces(allowed)
        // Start at the same place, or the first clinic if the doctor has left that one
        setPlace(placeOfAppointment(doctorResponse.data, found) ?? allowed[0])
        setChoice({ date: found.date, time: '' })
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [id])

  function choosePlace(next) {
    setError('')
    setPlace(next)
    setChoice((current) => ({ date: current.date, time: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!choice.time) {
      setError('Please pick a day and a new open time.')
      return
    }

    setSaving(true)
    try {
      await client.patch(`/appointments/${appointment.id}/reschedule`, {
        date: choice.date,
        start_time: choice.time,
        clinic_id: place.clinicId,
      })
      navigate('/appointments', {
        state: {
          notice: `Your appointment has been moved to ${formatDateKey(choice.date)} at ${formatTime(choice.time)}, ${place.label}.`,
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
              {formatDateKey(appointment.date)} at {formatTime(appointment.start_time)}
            </p>
            <p className="mt-1">{appointmentPlaceText(appointment)}</p>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-bold text-primary-dark">New date and time</h2>
            {places.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {places.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => choosePlace(item)}
                    className={`rounded-xl border px-4 py-2 font-semibold transition ${
                      item.key === place.key
                        ? 'border-primary bg-mint text-primary-dark'
                        : 'border-slate-200 text-slate-600 hover:border-primary/40'
                    }`}
                  >
                    {item.label} · {formatFee(item.fee)}
                  </button>
                ))}
              </div>
            )}
            {place.clinicId !== (appointment.clinic?.id ?? null) && (
              <p className="mb-5 rounded-2xl bg-pending px-4 py-3 text-sm font-medium text-pending-text">
                Your visit moves to {place.label}, {place.detail}. The fee there is{' '}
                {formatFee(place.fee)} (you booked at {formatFee(appointment.fee)}).
              </p>
            )}
            {/* A new place starts a fresh picker, so old open times never show for it */}
            <SlotPicker
              key={place.key}
              doctor={doctor}
              place={place}
              places={places}
              onPlaceChange={choosePlace}
              value={choice}
              onChange={setChoice}
              reloadKey={reloadKey}
            />
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
