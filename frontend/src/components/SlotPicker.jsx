import { useEffect, useState } from 'react'
import client, { getErrorMessage } from '../api/client'
import { formatTime, mondayIndex, toDateKey } from '../utils/format'
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

// Date strip for the next 14 days plus the open slots on the chosen day.
// value is { date: 'YYYY-MM-DD', time: 'HH:MM' }. Changing reloadKey fetches the slots again.
function SlotPicker({ doctor, value, onChange, reloadKey = 0 }) {
  const [days] = useState(nextDays)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(Boolean(value.date))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!value.date) return
    let ignore = false
    client
      .get(`/doctors/${doctor.id}/slots`, { params: { date: value.date } })
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
  }, [doctor.id, value.date, reloadKey])

  function pickDay(day) {
    setLoading(true)
    setError('')
    onChange({ date: toDateKey(day), time: '' })
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => {
          const key = toDateKey(day)
          const works = doctor.available_days.includes(mondayIndex(day))
          const selected = key === value.date
          return (
            <button
              key={key}
              type="button"
              disabled={!works}
              onClick={() => pickDay(day)}
              className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition ${
                selected
                  ? 'border-primary bg-primary text-white shadow-lg shadow-primary/25'
                  : works
                    ? 'border-slate-200 bg-white text-primary-dark hover:border-primary/50'
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
      {value.date && loading && <p className="text-slate-500">Loading open times...</p>}
      {value.date && !loading && !error && slots.length === 0 && (
        <p className="rounded-2xl bg-page px-4 py-3 text-slate-500">
          No open times left on this day. Please pick another day.
        </p>
      )}
      {value.date && !loading && slots.length > 0 && (
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
      )}
    </div>
  )
}

export default SlotPicker
