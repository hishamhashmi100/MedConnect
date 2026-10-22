import Alert from './Alert'

// Small "are you sure?" box for actions that can't be undone
function ConfirmDialog({ title, message, confirmLabel, busy, error, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
      <div className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div>
          <h2 className="text-2xl font-bold text-primary-dark">{title}</h2>
          <p className="mt-2 text-slate-500">{message}</p>
        </div>
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
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
