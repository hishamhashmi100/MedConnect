import { useEffect, useState } from 'react'
import { Building2, House } from 'lucide-react'
import client, { getErrorMessage } from '../api/client'
import {
  DAY_NAMES,
  doctorName,
  formatFee,
  formatTime,
  fromDateKey,
  mondayIndex,
  toDateKey,
} from '../utils/format'
import Alert from './Alert'

// Matches BOOKING_WINDOW_DAYS on the backend
const DAYS_AHEAD = 14

function nextDays() {
  const days = []
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date()
    day.setDate(day.getDate() + offset)
    days.push(day)
  }
  return days
}

// Buttons that switch to another place where the doctor works on the chosen day
function OtherPlaces({ places, onPlaceChange }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {places.map((other) => {
        const Icon = other.type === 'home' ? House : Building2
        return (
          <button
            key={other.key}
            type="button"
            onClick={() => onPlaceChange(other)}
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-white px-4 py-2 font-semibold text-primary-dark hover:bg-mint"
          >
            <Icon size={16} className="text-primary" />
            {other.label} · {formatFee(other.fee)}
          </button>
        )
      })}
    </div>
  )
}

// Date strip for the next 14 days plus the open slots on the chosen day at one place
// (a clinic or home visits, from bookingPlaces). places are all the places the patient may
// switch to; a day is clickable if the doctor works at any of them, and the picker says where
// the doctor is on a day the current place is closed. value is { date: 'YYYY-MM-DD', time:
// 'HH:MM' }. Changing reloadKey fetches the slots again.
function SlotPicker({ doctor, place, places, onPlaceChange, value, onChange, reloadKey = 0 }) {
  const [days] = useState(nextDays)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(Boolean(value.date))
  const [error, setError] = useState('')

  const weekday = value.date ? mondayIndex(fromDateKey(value.date)) : null
  const worksHere = place.days.includes(weekday)
  const otherPlaces = places.filter(
    (other) => other.key !== place.key && other.days.includes(weekday),
  )

  useEffect(() => {
    if (!value.date || !worksHere) return
    let ignore = false
    client
      .get(`/doctors/${doctor.id}/slots`, {
        params: {
          date: value.date,
          consultation_type: place.type,
          clinic_id: place.clinicId ?? undefined,
        },
      })
      .then((response) => {
        if (!ignore) setSlots(response.data.slots.map((slot) => slot.slice(0, 5)))
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [doctor.id, place.type, place.clinicId, value.date, worksHere, reloadKey])

  function pickDay(day) {
    setLoading(true)
    setError('')
    onChange({ date: toDateKey(day), time: '' })
  }

  const showSlots = value.date && worksHere && !loading && !error

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => {
          const key = toDateKey(day)
          const index = mondayIndex(day)
          const works = places.some((item) => item.days.includes(index))
          const here = place.days.includes(index)
          const selected = key === value.date
          return (
            <button
              key={key}
              type="button"
              disabled={!works}
              onClick={() => pickDay(day)}
              title={here || !works ? undefined : `Not ${place.where} this day`}
              className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition ${
                selected
                  ? 'border-primary bg-primary text-white shadow-lg shadow-primary/25'
                  : here
                    ? 'border-slate-200 bg-white text-primary-dark hover:border-primary/50'
                    : works
                      ? 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-primary/50'
                      : 'cursor-not-allowed border-slate-100 bg-page text-slate-300'
              }`}
            >
              <span className="text-xs font-semibold uppercase">
                {day.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span className="text-xl font-bold">{day.getDate()}</span>
              <span className="text-xs">{day.toLocaleDateString('en-GB', { month: 'short' })}</span>
            </button>
          )
        })}
      </div>

      {error && <Alert>{error}</Alert>}
      {!value.date && <p className="text-slate-500">Pick a day to see open times.</p>}

      {value.date && !worksHere && (
        <div className="rounded-2xl bg-page px-4 py-3 text-slate-600">
          <p>
            {doctorName(doctor.full_name)} is not {place.where} on {DAY_NAMES[weekday]}.
            {otherPlaces.length > 0 && ' On that day the doctor sees patients here instead:'}
          </p>
          <OtherPlaces places={otherPlaces} onPlaceChange={onPlaceChange} />
        </div>
      )}

      {value.date && worksHere && loading && (
        <p className="text-slate-500">Loading open times...</p>
      )}
      {showSlots && slots.length === 0 && (
        <div className="rounded-2xl bg-page px-4 py-3 text-slate-600">
          <p>
            No open times left {place.where} on this day.{' '}
            {otherPlaces.length > 0
              ? 'The doctor also sees patients here that day:'
              : 'Please pick another day.'}
          </p>
          <OtherPlaces places={otherPlaces} onPlaceChange={onPlaceChange} />
        </div>
      )}
      {showSlots && slots.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onChange({ ...value, time: slot })}
                className={`rounded-xl border px-3 py-2.5 font-semibold transition ${
                  slot === value.time
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-200 bg-white text-primary-dark hover:border-primary/50 hover:bg-mint'
                }`}
              >
                {formatTime(slot)}
              </button>
            ))}
          </div>
          {otherPlaces.length > 0 && (
            <div className="text-slate-500">
              <p>The doctor also sees patients here on this day:</p>
              <OtherPlaces places={otherPlaces} onPlaceChange={onPlaceChange} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SlotPicker
