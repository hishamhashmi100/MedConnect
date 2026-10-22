import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Clock, ShieldCheck, XCircle } from 'lucide-react'
import client, { getErrorMessage, notFoundAsNull } from '../../api/client'
import Alert from '../../components/Alert'
import DoctorAppointments from '../../components/DoctorAppointments'
import { useAuth } from '../../context/AuthContext'
import { DAY_NAMES, doctorName, formatFee, formatTime } from '../../utils/format'

// Shown instead of the appointments until the admin team approves the doctor
function StatusCard({ profile }) {
  if (profile.approval_status === 'rejected') {
    return (
      <div className="flex gap-4 rounded-3xl bg-red-50 p-6 text-red-800">
        <XCircle size={28} className="shrink-0" />
        <div>
          <p className="text-lg font-bold">Your profile was not approved</p>
          <p className="mt-1">Reason: {profile.rejection_reason}</p>
          <p className="mt-1">Update your profile and save it to send it for review again.</p>
          <Link
            to="/doctor/profile"
            className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 font-semibold text-red-800 hover:bg-red-100"
          >
            Edit profile
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 rounded-3xl bg-pending p-6 text-pending-text">
      <Clock size={28} className="shrink-0" />
      <div>
        <p className="text-lg font-bold">Your profile is under review</p>
        <p className="mt-1">
          Our admin team checks your PMDC number and details before patients can see you. You can
          still edit your profile and availability while you wait.
        </p>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

function DoctorHome() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      client.get('/doctor/profile').catch(notFoundAsNull),
      client.get('/doctor/availability'),
    ])
      .then(([profileResponse, availabilityResponse]) => {
        setProfile(profileResponse?.data ?? null)
        setBlocks(availabilityResponse.data)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-500">Loading...</p>
  if (error) return <Alert>{error}</Alert>
  // New doctors finish the two setup steps before seeing this page
  if (!profile) return <Navigate to="/doctor/profile" replace />
  if (blocks.length === 0) return <Navigate to="/doctor/availability" replace />

  const consultationTypes = [
    profile.offers_clinic && 'In-clinic',
    profile.offers_home_visit && 'Home visit',
  ].filter(Boolean)

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-dark sm:text-4xl">
            {doctorName(user.full_name)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-slate-600">PMDC Reg. No. {profile.pmdc_number}</span>
            {profile.approval_status === 'approved' && (
              <span className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-sm font-semibold text-primary-dark">
                <ShieldCheck size={16} /> Admin Approved
              </span>
            )}
          </div>
        </div>
        <Link
          to="/doctor/availability"
          className="rounded-2xl border border-primary/30 bg-white px-6 py-3 font-semibold text-primary-dark hover:bg-mint"
        >
          Availability settings
        </Link>
      </div>

      {profile.approval_status === 'approved' ? (
        <DoctorAppointments />
      ) : (
        <StatusCard profile={profile} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary-dark">Profile</h2>
            <Link
              to="/doctor/profile"
              className="font-semibold text-primary hover:text-primary-dark"
            >
              Edit
            </Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            <DetailRow label="Specialty" value={profile.specialty} />
            <DetailRow label="Location" value={`${profile.area}, ${profile.city}`} />
            <DetailRow label="Experience" value={`${profile.experience_years} years`} />
            <DetailRow label="Fee" value={formatFee(profile.fee)} />
            <DetailRow label="Consultation types" value={consultationTypes.join(', ')} />
            {profile.clinic_address && (
              <DetailRow label="Clinic address" value={profile.clinic_address} />
            )}
            <DetailRow label="Appointment length" value={`${profile.slot_minutes} minutes`} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary-dark">Weekly hours</h2>
            <Link
              to="/doctor/availability"
              className="font-semibold text-primary hover:text-primary-dark"
            >
              Edit
            </Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {DAY_NAMES.map((dayName, day) => {
              const dayBlocks = blocks.filter((block) => block.day_of_week === day)
              return (
                <DetailRow
                  key={dayName}
                  label={dayName}
                  value={
                    dayBlocks.length === 0
                      ? 'Not available'
                      : dayBlocks
                          .map(
                            (block) =>
                              `${formatTime(block.start_time)} - ${formatTime(block.end_time)}`,
                          )
                          .join(', ')
                  }
                />
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

export default DoctorHome
