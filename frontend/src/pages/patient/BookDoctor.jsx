import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, House } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import DoctorCard from '../../components/DoctorCard'
import Field from '../../components/Field'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import SelectField from '../../components/SelectField'
import SlotPicker from '../../components/SlotPicker'
import { doctorName, formatDateKey, formatFee, formatTime } from '../../utils/format'

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

function BookDoctor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState(null)
  const [cities, setCities] = useState([])
  const [type, setType] = useState('clinic')
  const [choice, setChoice] = useState({ date: '', time: '' })
  const [address, setAddress] = useState({ street: '', area: '', city: 'Karachi' })
  const [note, setNote] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([client.get(`/doctors/${id}`), client.get('/meta/cities')])
      .then(([doctorResponse, citiesResponse]) => {
        const data = doctorResponse.data
        setDoctor(data)
        setCities(citiesResponse.data)
        setType(data.offers_clinic ? 'clinic' : 'home')
        // Start on the day of the doctor's next open slot, if there is one this week
        setChoice({ date: data.next_open_slot ? data.next_open_slot.slice(0, 10) : '', time: '' })
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [id])

  function updateAddress(field, value) {
    setAddress((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!choice.time) {
      setError('Please pick a time slot.')
      return
    }
    if (type === 'home' && (!address.street.trim() || !address.area.trim())) {
      setError('Please enter the house or street and the area for the home visit.')
      return
    }

    setSaving(true)
    try {
      await client.post('/appointments', {
        doctor_id: doctor.id,
        date: choice.date,
        start_time: choice.time,
        consultation_type: type,
        home_address:
          type === 'home'
            ? `${address.street.trim()}, ${address.area.trim()}, ${address.city}`
            : null,
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

  const types = [
    doctor.offers_clinic && {
      value: 'clinic',
      label: 'In-clinic visit',
      detail: doctor.clinic_address,
      icon: Building2,
    },
    doctor.offers_home_visit && {
      value: 'home',
      label: 'Home visit',
      detail: 'The doctor comes to your address',
      icon: House,
    },
  ].filter(Boolean)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            <h2 className="text-xl font-bold text-primary-dark">Consultation type</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {types.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={`flex gap-3 rounded-2xl border p-4 text-left transition ${
                    type === item.value
                      ? 'border-primary bg-mint'
                      : 'border-slate-200 hover:border-primary/40'
                  }`}
                >
                  <item.icon size={22} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    <span className="block font-semibold text-primary-dark">{item.label}</span>
                    <span className="block text-sm text-slate-500">{item.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-bold text-primary-dark">Date and time</h2>
            <SlotPicker doctor={doctor} value={choice} onChange={setChoice} reloadKey={reloadKey} />
          </section>

          {type === 'home' && (
            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-bold text-primary-dark">Visit address</h2>
              <Field
                label="House and street"
                placeholder="House 12, Street 4, Block 7"
                value={address.street}
                onChange={(event) => updateAddress('street', event.target.value)}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Area"
                  placeholder="Gulshan-e-Iqbal"
                  value={address.area}
                  onChange={(event) => updateAddress('area', event.target.value)}
                  required
                />
                <SelectField
                  label="City"
                  value={address.city}
                  onChange={(event) => updateAddress('city', event.target.value)}
                >
                  {cities.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </SelectField>
              </div>
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
          </section>
        </div>

        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 xl:sticky xl:top-28">
          <h2 className="text-xl font-bold text-primary-dark">Summary</h2>
          <div className="divide-y divide-slate-100">
            <SummaryRow label="Doctor" value={doctorName(doctor.full_name)} />
            <SummaryRow label="Type" value={type === 'clinic' ? 'In-clinic visit' : 'Home visit'} />
            <SummaryRow label="Date" value={choice.date ? formatDateKey(choice.date) : '-'} />
            <SummaryRow label="Time" value={choice.time ? formatTime(choice.time) : '-'} />
            <SummaryRow label="Fee" value={formatFee(doctor.fee)} />
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
