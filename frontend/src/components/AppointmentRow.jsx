import { House, Stethoscope } from 'lucide-react'
import {
  cancelNote,
  doctorName,
  formatFee,
  formatShortDay,
  formatTime,
  patientStatus,
} from '../utils/format'
import { appointmentPlaceText } from '../utils/places'
import StatusBadge from './StatusBadge'

// One appointment in a list. now decides the badge for a visit whose time has come. "details" shows the address and note (used on My Appointments).
function AppointmentRow({ appointment, actions, details = false, now }) {
  const status = patientStatus(appointment, now)
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
            <p>{appointmentPlaceText(appointment)}</p>
            {/* The app doesn't record payments, so only an open visit mentions paying */}
            <p>
              Fee {formatFee(appointment.fee)}
              {appointment.status === 'confirmed' && ', payable at the visit'}
            </p>
            {appointment.patient_note && <p>Your note: {appointment.patient_note}</p>}
            {status === 'awaiting_completion' && (
              <p className="text-pending-text">
                {doctorName(appointment.doctor.full_name)} hasn't marked this visit as completed
                yet.
              </p>
            )}
            {appointment.status === 'cancelled' && (
              <p className="text-red-700">{cancelNote(appointment, 'patient')}</p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <StatusBadge status={status} />
        {actions}
      </div>
    </div>
  )
}

export default AppointmentRow
