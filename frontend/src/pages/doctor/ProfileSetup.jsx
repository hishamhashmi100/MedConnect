import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { getErrorMessage, notFoundAsNull } from '../../api/client'
import Alert from '../../components/Alert'
import DoctorDetailsFields from '../../components/DoctorDetailsFields'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import { doctorDetailsPayload, EMPTY_DOCTOR_DETAILS } from '../../utils/doctorDetails'
import { doctorDetailsErrors, useFieldErrors } from '../../utils/validation'

function toForm(profile) {
  const form = {}
  for (const field of Object.keys(EMPTY_DOCTOR_DETAILS)) {
    form[field] = profile[field] ?? ''
  }
  return form
}

function ProfileSetup() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_DOCTOR_DETAILS)
  const [profile, setProfile] = useState(null)
  const [specialties, setSpecialties] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const { show, touch, checkAll } = useFieldErrors(doctorDetailsErrors(form))

  useEffect(() => {
    Promise.all([
      client.get('/meta/specialties'),
      client.get('/doctor/profile').catch(notFoundAsNull),
    ])
      .then(([specialtiesResponse, profileResponse]) => {
        setSpecialties(specialtiesResponse.data)
        if (profileResponse) {
          setProfile(profileResponse.data)
          setForm(toForm(profileResponse.data))
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  function update(field, value) {
    setNotice('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  // The admin checked these two against the PMDC register, so changing them means a new review
  const changesReviewedDetails =
    profile?.approval_status === 'approved' &&
    (form.pmdc_number.trim().toUpperCase() !== profile.pmdc_number ||
      form.specialty !== profile.specialty)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!checkAll()) {
      setError('Please correct the fields marked in red.')
      return
    }

    setSaving(true)
    try {
      const response = await client.put('/doctor/profile', doctorDetailsPayload(form))
      // A doctor without a profile yet goes straight on to add their clinics
      if (!profile) {
        navigate('/doctor/clinics')
        return
      }
      const sentForReview =
        response.data.approval_status === 'pending' && profile.approval_status !== 'pending'
      setNotice(
        sentForReview
          ? 'Profile saved and sent to the admin team for review. Patients can book you again once it is approved.'
          : 'Profile saved.',
      )
      setProfile(response.data)
      setForm(toForm(response.data))
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
          eyebrow="Professional details"
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
        noValidate
        className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <DoctorDetailsFields
          form={form}
          update={update}
          show={show}
          touch={touch}
          specialties={specialties}
        />

        {changesReviewedDetails && (
          <p className="rounded-2xl bg-pending px-4 py-3 text-sm font-medium text-pending-text">
            Changing your PMDC number or specialty sends your profile back to the admin team for
            review. Patients can't book you until it is approved again. Your existing bookings stay.
          </p>
        )}
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
