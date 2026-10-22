import { House, Stethoscope } from 'lucide-react'
import { doctorName, formatShortDay, formatTime } from '../utils/format'
import StatusBadge from './StatusBadge'

// One appointment in a list. "details" shows the address and note (used on My Appointments).
function AppointmentRow({ appointment, actions, details = false }) {
  const isHome = appointment.consultation_type === 'home'
  const Icon = isHome ? House : Stethoscope

  return (
    <div className="flex flex-wrap items-start gap-4 py-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-primary">
        <Icon size={22} />
      </span>
      <div className="min-w-48 flex-1">
        <p className="text-lg font-semibold text-slate-800">
          {doctorName(appointment.doctor.full_name)}
        </p>
        <p className="text-slate-500">
          {appointment.doctor.specialty} · {formatShortDay(appointment.date)} ·{' '}
          {formatTime(appointment.start_time)}
        </p>
        {details && (
          <div className="mt-2 space-y-1 text-sm text-slate-500">
            <p>
              {isHome ? 'Home visit at ' : 'In-clinic at '}
              {isHome ? appointment.home_address : appointment.doctor.clinic_address}
            </p>
            {appointment.patient_note && <p>Your note: {appointment.patient_note}</p>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <StatusBadge status={appointment.status} />
        {actions}
      </div>
    </div>
  )
}

export default AppointmentRow
