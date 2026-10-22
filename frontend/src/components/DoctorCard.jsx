import { ShieldCheck } from 'lucide-react'
import { doctorName, formatFee, formatSlot } from '../utils/format'
import Avatar from './Avatar'

// Doctor summary used on the search page and the booking page. "action" is the button on the right.
function DoctorCard({ doctor, action }) {
  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 md:flex-row md:items-center">
      <div className="flex flex-1 gap-5">
        <Avatar name={doctor.full_name} size="xl" />
        <div className="min-w-0">
          <h3 className="text-2xl font-bold text-primary-dark">{doctorName(doctor.full_name)}</h3>
          <p className="mt-1 text-lg text-slate-500">
            {doctor.specialty} · {doctor.experience_years} years experience
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-slate-700">PMDC Reg. No. {doctor.pmdc_number}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 font-semibold text-primary-dark">
              <ShieldCheck size={16} /> Admin Approved
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {doctor.offers_clinic && (
              <span className="rounded-full bg-page px-3 py-1 text-sm font-medium text-slate-600">
                In-Clinic
              </span>
            )}
            {doctor.offers_home_visit && (
              <span className="rounded-full bg-page px-3 py-1 text-sm font-medium text-slate-600">
                Home Visit
              </span>
            )}
            <span className="ml-1 text-slate-500">
              {doctor.area}, {doctor.city}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-slate-100 pt-5 md:items-end md:border-t-0 md:border-l md:pt-0 md:pl-8 md:text-right">
        <p className="text-slate-500">Consultation fee</p>
        <p className="text-3xl font-bold text-primary-dark">{formatFee(doctor.fee)}</p>
        <p className="text-sm font-semibold text-primary">
          {doctor.next_open_slot
            ? `Next open slot: ${formatSlot(doctor.next_open_slot)}`
            : 'No open slots this week'}
        </p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}

export default DoctorCard
