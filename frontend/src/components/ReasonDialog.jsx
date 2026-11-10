import { useState } from 'react'
import { getErrorMessage } from '../api/client'
import { checkReason, useFieldErrors } from '../utils/validation'
import Alert from './Alert'
import FieldMessage from './FieldMessage'

// A box that asks for a reason before an action that someone else will see, like a doctor
// cancelling a booking or the admin rejecting a doctor. onSubmit(reason) sends the request.
function ReasonDialog({ title, message, warning, placeholder, confirmLabel, onSubmit, onCancel }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { show, touch, checkAll } = useFieldErrors({ reason: checkReason(reason) })

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!checkAll()) return

    setSaving(true)
    try {
      await onSubmit(reason.trim())
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-lg space-y-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div>
          <h2 className="text-2xl font-bold text-primary-dark">{title}</h2>
          <p className="mt-2 text-slate-500">{message}</p>
        </div>
        {warning && (
          <p className="rounded-2xl bg-pending px-4 py-3 text-sm font-medium text-pending-text">
            {warning}
          </p>
        )}
        <label className="block">
          <span className="text-sm font-semibold text-primary-dark">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => touch('reason')}
            rows={4}
            maxLength={500}
            placeholder={placeholder}
            aria-invalid={Boolean(show('reason'))}
            className={`mt-2 w-full rounded-2xl border px-4 py-3 text-slate-800 outline-none focus:ring-4 ${
              show('reason')
                ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                : 'border-slate-200 focus:border-primary focus:ring-primary/10'
            }`}
          />
          <FieldMessage error={show('reason')} hint={`${reason.trim().length} / 500 characters`} />
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-50"
          >
            Go back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ReasonDialog
