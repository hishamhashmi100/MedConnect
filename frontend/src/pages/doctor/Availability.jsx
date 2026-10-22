import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import client, { getErrorMessage, notFoundAsNull } from '../../api/client'
import Alert from '../../components/Alert'
import PageHeading from '../../components/PageHeading'
import PrimaryButton from '../../components/PrimaryButton'
import { DAY_NAMES } from '../../utils/format'

function Availability() {
  const navigate = useNavigate()
  const [blocks, setBlocks] = useState([])
  const [profile, setProfile] = useState(null)
  const [firstTime, setFirstTime] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([
      client.get('/doctor/profile').catch(notFoundAsNull),
      client.get('/doctor/availability'),
    ])
      .then(([profileResponse, availabilityResponse]) => {
        setProfile(profileResponse?.data ?? null)
        // The time inputs want "09:00", the API sends "09:00:00"
        setBlocks(
          availabilityResponse.data.map((block) => ({
            day_of_week: block.day_of_week,
            start_time: block.start_time.slice(0, 5),
            end_time: block.end_time.slice(0, 5),
          })),
        )
        setFirstTime(availabilityResponse.data.length === 0)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  function addBlock(day) {
    // A second block on the same day defaults to an evening clinic
    const hasBlock = blocks.some((block) => block.day_of_week === day)
    setBlocks([
      ...blocks,
      {
        day_of_week: day,
        start_time: hasBlock ? '17:00' : '09:00',
        end_time: hasBlock ? '21:00' : '13:00',
      },
    ])
  }

  function updateBlock(index, field, value) {
    setBlocks(blocks.map((block, i) => (i === index ? { ...block, [field]: value } : block)))
  }

  function removeBlock(index) {
    setBlocks(blocks.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setError('')
    setNotice('')
    if (blocks.length === 0) {
      setError('Please add at least one time block.')
      return
    }

    setSaving(true)
    try {
      await client.put('/doctor/availability', blocks)
      if (firstTime) {
        navigate('/doctor')
        return
      }
      setNotice('Availability saved.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>
  if (!profile && !error) return <Navigate to="/doctor/profile" replace />

  return (
    <div className="max-w-4xl">
      <PageHeading
        eyebrow={firstTime ? 'Step 2 of 2' : 'Weekly schedule'}
        title="Set your weekly availability"
        subtitle={`Patients book ${profile?.slot_minutes ?? 30}-minute appointments inside these hours. You can add more than one block on a day, for example a morning and an evening clinic.`}
      />

      <div className="mt-8 divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white px-6 sm:px-8">
        {DAY_NAMES.map((dayName, day) => {
          const dayBlocks = blocks
            .map((block, index) => ({ ...block, index }))
            .filter((block) => block.day_of_week === day)

          return (
            <div key={dayName} className="flex flex-wrap items-start gap-4 py-5">
              <p className="w-32 pt-2.5 font-semibold text-primary-dark">{dayName}</p>

              <div className="min-w-60 flex-1 space-y-3">
                {dayBlocks.length === 0 && <p className="pt-2.5 text-slate-400">Not available</p>}
                {dayBlocks.map((block) => (
                  <div key={block.index} className="flex flex-wrap items-center gap-3">
                    <input
                      type="time"
                      value={block.start_time}
                      onChange={(event) =>
                        updateBlock(block.index, 'start_time', event.target.value)
                      }
                      aria-label={`${dayName} start time`}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      required
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="time"
                      value={block.end_time}
                      onChange={(event) => updateBlock(block.index, 'end_time', event.target.value)}
                      aria-label={`${dayName} end time`}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      required
                    />
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
                ))}
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
        <div className="flex justify-end">
          <PrimaryButton type="button" wide={false} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : firstTime ? 'Save and finish' : 'Save availability'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export default Availability
