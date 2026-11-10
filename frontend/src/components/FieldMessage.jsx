// The line under a form field: the error in red, otherwise an optional grey hint
function FieldMessage({ error, hint }) {
  if (error) {
    return (
      <p role="alert" className="mt-1.5 px-2 text-sm text-red-600">
        {error}
      </p>
    )
  }
  if (hint) return <p className="mt-1.5 px-2 text-sm text-slate-500">{hint}</p>
  return null
}

export default FieldMessage
