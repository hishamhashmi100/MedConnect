import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, House } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import DoctorCard from '../../components/DoctorCard'
import Field from '../../components/Field'
import FieldMessage from '../../components/FieldMessage'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import SlotPicker from '../../components/SlotPicker'
import { doctorName, formatDateKey, formatFee, formatTime, mondayIndex } from '../../utils/format'
import { bookingPlaces } from '../../utils/places'
import { useFieldErrors } from '../../utils/validation'

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

// True when dateKey ('YYYY-MM-DD') falls on a weekday the doctor works at this place
function worksOn(place, dateKey) {
  return Boolean(dateKey) && place.days.includes(mondayIndex(new Date(`${dateKey}T00:00`)))
}

function BookDoctor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState(null)
  const [placeKey, setPlaceKey] = useState('')
  const [choice, setChoice] = useState({ date: '', time: '' })
  const [address, setAddress] = useState({ street: '', area: '' })
  const [note, setNote] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    client
      .get(`/doctors/${id}`)
      .then((response) => {
        const data = response.data
        setDoctor(data)
        // Start on the day of the doctor's next open slot, at a place they work that day
        const nextDay = data.next_open_slot ? data.next_open_slot.slice(0, 10) : ''
        const places = bookingPlaces(data)
        const first = places.find((item) => worksOn(item, nextDay)) ?? places[0]
        setPlaceKey(first.key)
        setChoice({ date: nextDay, time: '' })
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [id])

  const places = doctor ? bookingPlaces(doctor) : []
  const place = places.find((item) => item.key === placeKey)
  const isHome = place?.type === 'home'
  const { show, touch, checkAll } = useFieldErrors({
    slot: choice.time ? '' : 'Please pick a day and an open time.',
    street:
      isHome && address.street.trim().length < 5
        ? 'Please enter the house number and street, for example House 12, Street 4.'
        : '',
    area: isHome && address.area.trim().length < 3 ? 'Please enter the area, for example DHA.' : '',
  })

  function choosePlace(next) {
    setPlaceKey(next.key)
    // Keep the chosen day; the slot picker says so if the doctor isn't at the new place then
    setChoice((current) => ({ date: current.date, time: '' }))
  }

  function updateAddress(field, value) {
    setAddress((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!checkAll()) {
      setError('Please complete the details marked in red.')
      return
    }

    setSaving(true)
    try {
      await client.post('/appointments', {
        doctor_id: doctor.id,
        date: choice.date,
        start_time: choice.time,
        consultation_type: place.type,
        clinic_id: place.clinicId,
        home_address: isHome ? `${address.street.trim()}, ${address.area.trim()}, Karachi` : null,
        patient_note: note.trim() || null,
      })
      navigate('/appointments', {
        state: {
          notice: `Your appointment with ${doctorName(doctor.full_name)} on ${formatDateKey(choice.date)} at ${formatTime(choice.time)} is confirmed.`,
        },
      })
    } catch (err) {
      setError(getErrorMessage(err))
      // Someone else took the slot, so show the latest open times
      if (err.response?.status === 409) {
        setChoice((current) => ({ ...current, time: '' }))
        setReloadKey((key) => key + 1)
      }
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>
  if (!doctor) return <Alert>{error}</Alert>

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Link
        to="/doctors"
        className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary-dark"
      >
        <ArrowLeft size={18} /> Back to doctors
      </Link>

      <PageHeading eyebrow="Book appointment" title="Choose a time that suits you" />

      <DoctorCard doctor={doctor} />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        {/* min-w-0 lets the wide date strip scroll inside the column instead of stretching it */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold text-primary-dark">Where</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {places.map((item) => {
                const Icon = item.type === 'home' ? House : Building2
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => choosePlace(item)}
                    className={`flex gap-3 rounded-2xl border p-4 text-left transition ${
                      placeKey === item.key
                        ? 'border-primary bg-mint'
                        : 'border-slate-200 hover:border-primary/40'
                    }`}
                  >
                    <Icon size={22} className="mt-0.5 shrink-0 text-primary" />
                    <span className="flex-1">
                      <span className="block font-semibold text-primary-dark">{item.label}</span>
                      <span className="block text-sm text-slate-500">{item.detail}</span>
                    </span>
                    <span className="font-semibold text-primary-dark">{formatFee(item.fee)}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-bold text-primary-dark">Date and time</h2>
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
            <FieldMessage error={show('slot')} />
          </section>

          {isHome && (
            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-bold text-primary-dark">Visit address</h2>
              <Field
                label="House and street"
                placeholder="House 12, Street 4, Block 7"
                value={address.street}
                onChange={(event) => updateAddress('street', event.target.value)}
                onBlur={() => touch('street')}
                error={show('street')}
                maxLength={150}
              />
              <Field
                label="Area in Karachi"
                placeholder="Gulshan-e-Iqbal"
                value={address.area}
                onChange={(event) => updateAddress('area', event.target.value)}
                onBlur={() => touch('area')}
                error={show('area')}
                hint="Home visits are available in Karachi only."
                maxLength={60}
              />
            </section>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold text-primary-dark">Note for the doctor</h2>
            <p className="mt-1 text-slate-500">
              Optional. For example, your symptoms or reason for the visit.
            </p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <p className="mt-1 text-right text-sm text-slate-400">{note.length} / 500</p>
          </section>
        </div>

        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 xl:sticky xl:top-28">
          <h2 className="text-xl font-bold text-primary-dark">Summary</h2>
          <div className="divide-y divide-slate-100">
            <SummaryRow label="Doctor" value={doctorName(doctor.full_name)} />
            <SummaryRow label="Where" value={place.label} />
            <SummaryRow label="Date" value={choice.date ? formatDateKey(choice.date) : '-'} />
            <SummaryRow label="Time" value={choice.time ? formatTime(choice.time) : '-'} />
            <SummaryRow label="Fee" value={formatFee(place.fee)} />
          </div>
          <p className="text-sm text-slate-500">The fee is paid to the doctor at the visit.</p>
          {error && <Alert>{error}</Alert>}
          <PrimaryButton disabled={saving}>
            {saving ? 'Booking...' : 'Confirm booking'}
          </PrimaryButton>
        </aside>
      </div>
    </form>
  )
}

export default BookDoctor
