import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import client, { getErrorMessage, notFoundAsNull } from '../../api/client'
import Alert from '../../components/Alert'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import SelectField from '../../components/SelectField'
import { DAY_NAMES, formatShortDay, formatTime } from '../../utils/format'

const MINUTES_IN_DAY = 24 * 60

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

// A block that ends at or before its start runs overnight into the next day
function isOvernight(block) {
  return toMinutes(block.end_time) <= toMinutes(block.start_time)
}

// The parts of a block as { day, start, end } in minutes, splitting an overnight block at
// midnight. Matches segments_on in the backend's slots.py.
function blockParts(block) {
  const start = toMinutes(block.start_time)
  const end = toMinutes(block.end_time)
  if (!isOvernight(block)) return [{ day: block.day_of_week, start, end }]
  const parts = [{ day: block.day_of_week, start, end: MINUTES_IN_DAY }]
  if (end > 0) parts.push({ day: (block.day_of_week + 1) % 7, start: 0, end })
  return parts
}

// The same checks the backend makes, shown under each block while the doctor edits.
// Returns one message per block index ('' when the block is fine).
function blockErrors(blocks, slotMinutes) {
  return blocks.map((block, index) => {
    if (!block.start_time || !block.end_time) return 'Please enter both a start and an end time.'
    const start = toMinutes(block.start_time)
    const end = toMinutes(block.end_time)
    if (end === start) return "The start and end times can't be the same."
    if ((end - start + MINUTES_IN_DAY) % MINUTES_IN_DAY < slotMinutes) {
      return `A block must be at least ${slotMinutes} minutes long, the length of one appointment.`
    }
    const parts = blockParts(block)
    const overlaps = blocks.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        other.start_time &&
        other.end_time &&
        other.start_time !== other.end_time &&
        blockParts(other).some((otherPart) =>
          parts.some(
            (part) =>
              part.day === otherPart.day &&
              part.start < otherPart.end &&
              otherPart.start < part.end,
          ),
        ),
    )
    return overlaps ? 'This block overlaps another block.' : ''
  })
}

const TIME_INPUT =
  'rounded-xl border px-3 py-2 text-slate-800 outline-none focus:ring-4 focus:ring-primary/10'

// The location dropdown uses "home" for home visits and the clinic id for a clinic
function toPlaceValue(clinicId) {
  return clinicId === null ? 'home' : String(clinicId)
}

function fromPlaceValue(value) {
  return value === 'home' ? null : Number(value)
}

function Availability() {
  const navigate = useNavigate()
  const [blocks, setBlocks] = useState([])
  const [profile, setProfile] = useState(null)
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [slotLengths, setSlotLengths] = useState([])
  const [firstTime, setFirstTime] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [outsideHours, setOutsideHours] = useState([])

  useEffect(() => {
    Promise.all([
      client.get('/doctor/profile').catch(notFoundAsNull),
      client.get('/doctor/availability'),
      client.get('/meta/slot-lengths'),
    ])
      .then(([profileResponse, availabilityResponse, slotLengthsResponse]) => {
        const data = profileResponse?.data ?? null
        setProfile(data)
        setSlotMinutes(data?.slot_minutes ?? 30)
        setSlotLengths(slotLengthsResponse.data)
        // The time inputs want "09:00", the API sends "09:00:00"
        setBlocks(
          availabilityResponse.data.map((block) => ({
            day_of_week: block.day_of_week,
            start_time: block.start_time.slice(0, 5),
            end_time: block.end_time.slice(0, 5),
            clinic_id: block.clinic_id,
          })),
        )
        setFirstTime(availabilityResponse.data.length === 0)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const errors = blockErrors(blocks, slotMinutes)
  const places = profile
    ? [
        ...profile.clinics.map((clinic) => ({ value: String(clinic.id), label: clinic.name })),
        ...(profile.offers_home_visit ? [{ value: 'home', label: 'Home visits' }] : []),
      ]
    : []

  function clearMessages() {
    setNotice('')
    setError('')
  }

  function changeBlocks(next) {
    clearMessages()
    setBlocks(next)
  }

  function addBlock(day) {
    // A second block on the same day defaults to an evening clinic
    const hasBlock = blocks.some((block) => block.day_of_week === day)
    changeBlocks([
      ...blocks,
      {
        day_of_week: day,
        start_time: hasBlock ? '17:00' : '09:00',
        end_time: hasBlock ? '21:00' : '13:00',
        clinic_id: fromPlaceValue(places[0].value),
      },
    ])
  }

  function updateBlock(index, field, value) {
    changeBlocks(blocks.map((block, i) => (i === index ? { ...block, [field]: value } : block)))
  }

  function removeBlock(index) {
    changeBlocks(blocks.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setError('')
    setNotice('')
    setOutsideHours([])
    if (blocks.length === 0) {
      setError('Please add at least one time block, so patients can book you.')
      return
    }
    if (errors.some(Boolean)) {
      setError('Please fix the time blocks marked in red.')
      return
    }

    setSaving(true)
    try {
      const response = await client.put('/doctor/availability', {
        slot_minutes: slotMinutes,
        blocks,
      })
      if (firstTime) {
        navigate('/doctor')
        return
      }
      setOutsideHours(response.data.outside_hours)
      setNotice('Saved. Patients now see your new hours.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>
  if (!profile && !error) return <Navigate to="/doctor/profile" replace />
  // Hours are always at a clinic or for home visits, so those come first
  if (profile && places.length === 0) return <Navigate to="/doctor/clinics" replace />

  return (
    <div className="max-w-4xl">
      <PageHeading
        eyebrow={firstTime ? 'Step 2 of 2' : 'Weekly hours'}
        title="Set your weekly hours"
        subtitle={`For each block, choose where you are: one of your clinics or home visits. Patients book ${slotMinutes}-minute appointments inside these hours.`}
      />

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="sm:w-1/2 sm:pr-2">
          <SelectField
            label="Appointment length"
            value={slotMinutes}
            onChange={(event) => {
              clearMessages()
              setSlotMinutes(Number(event.target.value))
            }}
            hint="How long each booking with you lasts. Bookings already made keep their times."
          >
            {slotLengths.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <div className="mt-6 divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white px-6 sm:px-8">
        {DAY_NAMES.map((dayName, day) => {
          const dayBlocks = blocks
            .map((block, index) => ({ ...block, index }))
            .filter((block) => block.day_of_week === day)

          return (
            <div key={dayName} className="flex flex-wrap items-start gap-4 py-5">
              <p className="w-32 pt-2.5 font-semibold text-primary-dark">{dayName}</p>

              <div className="min-w-60 flex-1 space-y-3">
                {dayBlocks.length === 0 && <p className="pt-2.5 text-slate-400">Not available</p>}
                {dayBlocks.map((block) => {
                  const blockError = errors[block.index]
                  const border = blockError
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-slate-200 focus:border-primary'
                  return (
                    <div key={block.index}>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="time"
                          value={block.start_time}
                          onChange={(event) =>
                            updateBlock(block.index, 'start_time', event.target.value)
                          }
                          aria-label={`${dayName} start time`}
                          aria-invalid={Boolean(blockError)}
                          className={`${TIME_INPUT} ${border}`}
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          type="time"
                          value={block.end_time}
                          onChange={(event) =>
                            updateBlock(block.index, 'end_time', event.target.value)
                          }
                          aria-label={`${dayName} end time`}
                          aria-invalid={Boolean(blockError)}
                          className={`${TIME_INPUT} ${border}`}
                        />
                        <select
                          value={toPlaceValue(block.clinic_id)}
                          onChange={(event) =>
                            updateBlock(
                              block.index,
                              'clinic_id',
                              fromPlaceValue(event.target.value),
                            )
                          }
                          aria-label={`${dayName} location`}
                          className={`${TIME_INPUT} w-56 border-slate-200 focus:border-primary`}
                        >
                          {places.map((place) => (
                            <option key={place.value} value={place.value}>
                              {place.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeBlock(block.index)}
                          aria-label={`Remove ${dayName} block`}
                          title="Remove"
                          className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {blockError && (
                        <p role="alert" className="mt-1.5 text-sm text-red-600">
                          {blockError}
                        </p>
                      )}
                      {!blockError && isOvernight(block) && (
                        <p className="mt-1.5 text-sm text-slate-500">
                          {block.end_time === '00:00'
                            ? 'Ends at midnight.'
                            : `Runs overnight and ends at ${formatTime(block.end_time)} on ${DAY_NAMES[(day + 1) % 7]}.`}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => addBlock(day)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 font-semibold text-primary hover:bg-mint"
              >
                <Plus size={18} /> Add block
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert type="success">{notice}</Alert>}
        {outsideHours.length > 0 && (
          <div className="rounded-2xl bg-pending px-5 py-4 text-pending-text">
            <p className="font-semibold">
              {outsideHours.length === 1
                ? '1 booking is outside your new hours'
                : `${outsideHours.length} bookings are outside your new hours`}
            </p>
            <p className="mt-1 text-sm">
              These patients booked under your old hours and are still expecting you. Keep the
              visit, or cancel it from your home page so the patient is told.
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {outsideHours.map((item) => (
                <li key={item.id}>
                  {item.patient.full_name}, {formatShortDay(item.date)} at{' '}
                  {formatTime(item.start_time)}
                </li>
              ))}
            </ul>
            <Link to="/doctor" className="mt-3 inline-block font-semibold underline">
              Review on your home page
            </Link>
          </div>
        )}
        <div className="flex justify-end">
          <PrimaryButton type="button" wide={false} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : firstTime ? 'Save and finish' : 'Save weekly hours'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export default Availability
