import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, House, Plus, Trash2 } from 'lucide-react'
import client, { getErrorMessage, notFoundAsNull } from '../../api/client'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import FieldMessage from '../../components/FieldMessage'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import { checkFee, clinicErrors, useFieldErrors } from '../../utils/validation'

const CLINIC_FIELDS = ['name', 'area', 'address', 'fee']

// Each clinic on the page gets a key of its own, so React and the error messages keep
// following the right clinic when one above it is removed
let nextKey = 1

function toFormClinic(clinic) {
  return { ...clinic, fee: String(clinic.fee), key: nextKey++ }
}

function emptyClinic() {
  return { id: null, name: '', area: '', address: '', fee: '', key: nextKey++ }
}

function Clinics() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [clinics, setClinics] = useState([])
  const [homeVisits, setHomeVisits] = useState(false)
  const [homeFee, setHomeFee] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function fillFrom(data) {
    setProfile(data)
    // A new doctor starts with one empty clinic to fill in
    const firstTime = data.clinics.length === 0 && !data.offers_home_visit
    setClinics(firstTime ? [emptyClinic()] : data.clinics.map(toFormClinic))
    setHomeVisits(data.offers_home_visit)
    setHomeFee(data.home_visit_fee === null ? '' : String(data.home_visit_fee))
  }

  useEffect(() => {
    client
      .get('/doctor/profile')
      .catch(notFoundAsNull)
      .then((response) => {
        if (response) fillFrom(response.data)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  // One flat list of errors, keyed like "3.name", so useFieldErrors can track each box
  const errors = { home_visit_fee: homeVisits ? checkFee(homeFee) : '' }
  for (const clinic of clinics) {
    const clinicError = clinicErrors(clinic)
    for (const field of CLINIC_FIELDS) errors[`${clinic.key}.${field}`] = clinicError[field]
  }
  const { show, touch, checkAll } = useFieldErrors(errors)

  function clearMessages() {
    setError('')
    setNotice('')
  }

  function updateClinic(key, field, value) {
    clearMessages()
    setClinics((current) =>
      current.map((clinic) => (clinic.key === key ? { ...clinic, [field]: value } : clinic)),
    )
  }

  function removeClinic(key) {
    clearMessages()
    setClinics((current) => current.filter((clinic) => clinic.key !== key))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    clearMessages()
    if (clinics.length === 0 && !homeVisits) {
      setError('Please add a clinic or turn on home visits, so patients can book you.')
      return
    }
    if (!checkAll()) {
      setError('Please correct the fields marked in red.')
      return
    }

    const firstTime = profile.clinics.length === 0 && !profile.offers_home_visit
    setSaving(true)
    try {
      const response = await client.put('/doctor/clinics', {
        clinics: clinics.map((clinic) => ({
          id: clinic.id,
          name: clinic.name,
          area: clinic.area,
          address: clinic.address,
          fee: Number(clinic.fee),
        })),
        offers_home_visit: homeVisits,
        home_visit_fee: homeVisits ? Number(homeFee) : null,
      })
      // A new doctor goes straight on to set their weekly hours
      if (firstTime) {
        navigate('/doctor/availability')
        return
      }
      fillFrom(response.data)
      setNotice('Saved. Patients now see your clinics and fees.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>
  if (!profile && !error) return <Navigate to="/doctor/profile" replace />

  const firstTime = profile && profile.clinics.length === 0 && !profile.offers_home_visit

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-4xl space-y-6">
      <PageHeading
        eyebrow={firstTime ? 'Step 1 of 2' : 'Clinics and fees'}
        title="Where you see patients"
        subtitle="Add each clinic or hospital you work at, with the fee you charge there. Patients choose the place when they book."
      />

      {clinics.map((clinic, index) => (
        <section
          key={clinic.key}
          className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-primary-dark">
              <Building2 size={20} className="text-primary" />
              {clinic.name.trim() || `Clinic ${index + 1}`}
            </h2>
            <button
              type="button"
              onClick={() => removeClinic(clinic.key)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} /> Remove
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Clinic or hospital name"
              placeholder="Clifton Heart Centre"
              value={clinic.name}
              onChange={(event) => updateClinic(clinic.key, 'name', event.target.value)}
              onBlur={() => touch(`${clinic.key}.name`)}
              error={show(`${clinic.key}.name`)}
              maxLength={100}
            />
            <Field
              label="Area in Karachi"
              placeholder="Clifton"
              value={clinic.area}
              onChange={(event) => updateClinic(clinic.key, 'area', event.target.value)}
              onBlur={() => touch(`${clinic.key}.area`)}
              error={show(`${clinic.key}.area`)}
              maxLength={100}
            />
            <div className="sm:col-span-2">
              <Field
                label="Full address"
                placeholder="Plot 21, Block 4, Clifton, Karachi"
                value={clinic.address}
                onChange={(event) => updateClinic(clinic.key, 'address', event.target.value)}
                onBlur={() => touch(`${clinic.key}.address`)}
                error={show(`${clinic.key}.address`)}
                maxLength={255}
              />
            </div>
            <Field
              label="Consultation fee here (Rs.)"
              type="number"
              inputMode="numeric"
              min="100"
              max="50000"
              placeholder="2500"
              value={clinic.fee}
              onChange={(event) => updateClinic(clinic.key, 'fee', event.target.value)}
              onBlur={() => touch(`${clinic.key}.fee`)}
              error={show(`${clinic.key}.fee`)}
            />
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={() => {
          clearMessages()
          setClinics((current) => [...current, emptyClinic()])
        }}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 py-5 font-semibold text-primary hover:border-primary/50 hover:bg-mint"
      >
        <Plus size={20} /> Add a clinic or hospital
      </button>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={homeVisits}
            onChange={(event) => {
              clearMessages()
              setHomeVisits(event.target.checked)
            }}
            className="h-5 w-5 accent-primary"
          />
          <House size={20} className="text-primary" />
          <span className="text-lg font-bold text-primary-dark">I also do home visits</span>
        </label>
        <p className="mt-1 text-slate-500">
          Patients in Karachi can book you to come to their home.
        </p>
        {homeVisits && (
          <div className="mt-4 sm:w-1/2 sm:pr-2">
            <Field
              label="Home visit fee (Rs.)"
              type="number"
              inputMode="numeric"
              min="100"
              max="50000"
              placeholder="3500"
              value={homeFee}
              onChange={(event) => {
                clearMessages()
                setHomeFee(event.target.value)
              }}
              onBlur={() => touch('home_visit_fee')}
              error={show('home_visit_fee')}
            />
          </div>
        )}
      </section>

      <FieldMessage hint="Removing a clinic, or turning home visits off, also removes those weekly hours." />
      {error && <Alert>{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      <div className="flex justify-end">
        <PrimaryButton wide={false} disabled={saving}>
          {saving ? 'Saving...' : firstTime ? 'Save and continue' : 'Save clinics and fees'}
        </PrimaryButton>
      </div>
    </form>
  )
}

export default Clinics
