import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import PageHeading from '../../components/PageHeading'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { doctorName, formatFee, formatShortDate } from '../../utils/format'

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function RejectDialog({ doctor, onCancel, onRejected }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await client.post(`/admin/doctors/${doctor.id}/reject`, { reason })
      onRejected()
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div>
          <h2 className="text-2xl font-bold text-primary-dark">
            Reject {doctorName(doctor.full_name)}
          </h2>
          <p className="mt-2 text-slate-500">
            The doctor sees this reason and can fix their profile and submit it again.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-semibold text-primary-dark">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            required
            minLength={5}
            maxLength={500}
            placeholder="For example: PMDC number could not be verified"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? 'Rejecting...' : 'Reject doctor'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AdminHome() {
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('pending')
  const [doctors, setDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [rejecting, setRejecting] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const queueRef = useRef(null)

  function loadStats() {
    client
      .get('/admin/stats')
      .then((response) => setStats(response.data))
      .catch((err) => setError(getErrorMessage(err)))
  }

  function loadDoctors(status) {
    client
      .get('/admin/doctors', { params: { status } })
      .then((response) => setDoctors(response.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingDoctors(false))
  }

  useEffect(loadStats, [])
  useEffect(() => loadDoctors(tab), [tab])

  function changeTab(value) {
    if (value === tab) return
    setLoadingDoctors(true)
    setTab(value)
  }

  // After a decision the doctor leaves this tab and the counts change
  function refresh() {
    loadStats()
    loadDoctors(tab)
  }

  async function approve(doctor) {
    setError('')
    setBusyId(doctor.id)
    try {
      await client.post(`/admin/doctors/${doctor.id}/approve`)
      refresh()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  function reviewPending() {
    changeTab('pending')
    queueRef.current.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Admin control centre"
        title="Platform overview"
        subtitle="Manual review keeps the MedConnect community trusted."
        action={
          <button
            type="button"
            onClick={reviewPending}
            className="rounded-2xl bg-primary px-6 py-4 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark"
          >
            Review all pending
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

      {stats && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Patients"
            value={stats.patients}
            note={`${stats.new_patients_this_month} new this month`}
          />
          <StatCard
            label="Appointments booked"
            value={stats.appointments_this_month}
            note="This month"
          />
          <StatCard
            label="Approved doctors"
            value={stats.approved_doctors}
            note="Visible to patients"
          />
          <StatCard
            label="Pending approvals"
            value={stats.pending_approvals}
            note={stats.pending_approvals > 0 ? 'Needs attention' : 'All caught up'}
          />
        </div>
      )}

      <section
        ref={queueRef}
        className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
              Manual review queue
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-primary-dark">
              Doctor approvals
            </h2>
          </div>
          <div className="flex rounded-full bg-mint p-1.5">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => changeTab(item.value)}
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

        <p className="mt-6 flex items-center gap-3 rounded-2xl bg-mint/70 px-5 py-4 text-primary-dark">
          <ShieldCheck size={20} className="shrink-0" />
          Approval is a manual review decision by the MedConnect PK admin team.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-sm tracking-wider text-slate-500 uppercase">
                <th className="py-4 pr-4 font-medium">Doctor</th>
                <th className="py-4 pr-4 font-medium">Specialty</th>
                <th className="py-4 pr-4 font-medium">PMDC Reg. No.</th>
                <th className="py-4 pr-4 font-medium">Submitted</th>
                <th className="py-4 pr-4 font-medium">Status</th>
                <th className="py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loadingDoctors && doctors.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No {tab} doctors right now.
                  </td>
                </tr>
              )}
              {doctors.map((doctor) => (
                <tr key={doctor.id} className="align-top">
                  <td className="py-5 pr-4">
                    <p className="font-semibold text-slate-800">{doctorName(doctor.full_name)}</p>
                    <p className="text-slate-500">
                      {doctor.area}, {doctor.city}
                    </p>
                    <p className="text-sm text-slate-400">{doctor.email}</p>
                    {doctor.rejection_reason && (
                      <p className="mt-1 text-sm text-red-700">Reason: {doctor.rejection_reason}</p>
                    )}
                  </td>
                  <td className="py-5 pr-4">
                    <p className="text-slate-800">{doctor.specialty}</p>
                    <p className="text-sm text-slate-500">
                      {doctor.experience_years} years · {formatFee(doctor.fee)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[
                        doctor.offers_clinic && 'In-clinic',
                        doctor.offers_home_visit && 'Home visit',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </td>
                  <td className="py-5 pr-4 font-mono text-slate-800">{doctor.pmdc_number}</td>
                  <td className="py-5 pr-4 text-slate-600">
                    {formatShortDate(doctor.submitted_at)}
                  </td>
                  <td className="py-5 pr-4">
                    <StatusBadge status={doctor.approval_status} />
                  </td>
                  <td className="py-5">
                    <div className="flex gap-2">
                      {doctor.approval_status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => approve(doctor)}
                          disabled={busyId === doctor.id}
                          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary-dark disabled:opacity-60"
                        >
                          Approve
                        </button>
                      )}
                      {doctor.approval_status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => setRejecting(doctor)}
                          className="rounded-xl border border-primary/30 px-4 py-2.5 text-sm font-semibold text-primary-dark hover:bg-mint"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rejecting && (
        <RejectDialog
          doctor={rejecting}
          onCancel={() => setRejecting(null)}
          onRejected={() => {
            setRejecting(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

export default AdminHome
