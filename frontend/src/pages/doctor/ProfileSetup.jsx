import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, House } from 'lucide-react'
import client, { getErrorMessage, notFoundAsNull } from '../../api/client'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import SelectField from '../../components/SelectField'

const EMPTY_FORM = {
  specialty: '',
  pmdc_number: '',
  experience_years: '',
  city: 'Karachi',
  area: '',
  clinic_address: '',
  fee: '',
  offers_clinic: true,
  offers_home_visit: false,
  slot_minutes: 30,
}

const CONSULTATION_TYPES = [
  { field: 'offers_clinic', label: 'In-clinic', icon: Building2 },
  { field: 'offers_home_visit', label: 'Home visit', icon: House },
]

function toForm(profile) {
  const form = {}
  for (const field of Object.keys(EMPTY_FORM)) {
    form[field] = profile[field] ?? ''
  }
  return form
}

function ProfileSetup() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [profile, setProfile] = useState(null)
  const [options, setOptions] = useState({ specialties: [], cities: [], slotLengths: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([
      client.get('/meta/specialties'),
      client.get('/meta/cities'),
      client.get('/meta/slot-lengths'),
      client.get('/doctor/profile').catch(notFoundAsNull),
    ])
      .then(([specialties, cities, slotLengths, profileResponse]) => {
        setOptions({
          specialties: specialties.data,
          cities: cities.data,
          slotLengths: slotLengths.data,
        })
        if (profileResponse) {
          setProfile(profileResponse.data)
          setForm(toForm(profileResponse.data))
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!form.offers_clinic && !form.offers_home_visit) {
      setError('Please choose at least one consultation type.')
      return
    }

    setSaving(true)
    try {
      const response = await client.put('/doctor/profile', {
        ...form,
        experience_years: Number(form.experience_years),
        fee: Number(form.fee),
        slot_minutes: Number(form.slot_minutes),
        clinic_address: form.offers_clinic ? form.clinic_address : null,
      })
      // A brand new doctor goes straight on to set their weekly hours
      if (!profile) {
        navigate('/doctor/availability')
        return
      }
      setNotice(
        profile.approval_status === 'rejected'
          ? 'Profile saved and sent to the admin team for review again.'
          : 'Profile saved.',
      )
      setProfile(response.data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>

  return (
    <div className="max-w-4xl">
      {profile ? (
        <PageHeading
          eyebrow="Doctor profile"
          title="Your profile"
          subtitle="Patients see these details when they search for doctors."
        />
      ) : (
        <PageHeading
          eyebrow="Step 1 of 2"
          title="Set up your profile"
          subtitle="Patients see these details when they search for doctors. Our admin team checks your PMDC number before your profile goes live."
        />
      )}

      {profile?.approval_status === 'rejected' && (
        <div className="mt-6">
          <Alert>
            Your profile was not approved. Reason: {profile.rejection_reason}. Update your details
            and save to send it for review again.
          </Alert>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <SelectField
            label="Specialty"
            value={form.specialty}
            onChange={(event) => update('specialty', event.target.value)}
            required
          >
            <option value="" disabled>
              Choose your specialty
            </option>
            {options.specialties.map((specialty) => (
              <option key={specialty}>{specialty}</option>
            ))}
          </SelectField>
          <Field
            label="PMDC registration number"
            placeholder="12345-P"
            value={form.pmdc_number}
            onChange={(event) => update('pmdc_number', event.target.value)}
            required
          />
          <Field
            label="Years of experience"
            type="number"
            min="0"
            max="60"
            value={form.experience_years}
            onChange={(event) => update('experience_years', event.target.value)}
            required
          />
          <Field
            label="Consultation fee (Rs.)"
            type="number"
            min="1"
            placeholder="2500"
            value={form.fee}
            onChange={(event) => update('fee', event.target.value)}
            required
          />
          <SelectField
            label="City"
            value={form.city}
            onChange={(event) => update('city', event.target.value)}
          >
            {options.cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </SelectField>
          <Field
            label="Area"
            placeholder="Clifton"
            value={form.area}
            onChange={(event) => update('area', event.target.value)}
            required
          />
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-primary-dark">Consultation types</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONSULTATION_TYPES.map((type) => (
              <label
                key={type.field}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-5 py-4 transition ${
                  form[type.field]
                    ? 'border-primary bg-mint text-primary-dark'
                    : 'border-slate-200 text-slate-600 hover:border-primary/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form[type.field]}
                  onChange={(event) => update(type.field, event.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
                <type.icon size={20} />
                <span className="font-semibold">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {form.offers_clinic && (
          <Field
            label="Clinic address"
            placeholder="Plot 4, Block 5, Clifton, Karachi"
            value={form.clinic_address}
            onChange={(event) => update('clinic_address', event.target.value)}
            required
          />
        )}

        <div className="md:w-1/2">
          <SelectField
            label="Appointment length"
            value={form.slot_minutes}
            onChange={(event) => update('slot_minutes', event.target.value)}
          >
            {options.slotLengths.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </SelectField>
        </div>

        {error && <Alert>{error}</Alert>}
        {notice && <Alert type="success">{notice}</Alert>}

        <div className="flex justify-end pt-2">
          <PrimaryButton wide={false} disabled={saving}>
            {saving ? 'Saving...' : profile ? 'Save changes' : 'Save and continue'}
          </PrimaryButton>
        </div>
      </form>
    </div>
  )
}

export default ProfileSetup
