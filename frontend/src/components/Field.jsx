import FieldMessage from './FieldMessage'

// Text input in a rounded box. With a label it matches the login design (small label above
// the value), without one it is a plain placeholder box like the register design.
// error turns the box red and shows the message under it; hint shows when there is no error.
function Field({ label, error, hint, ...inputProps }) {
  return (
    <div>
      <label
        className={`block rounded-2xl border bg-white px-5 py-3 transition focus-within:ring-4 ${
          error
            ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-100'
            : 'border-slate-200 focus-within:border-primary focus-within:ring-primary/10'
        }`}
      >
        {label && <span className="block text-xs font-semibold text-primary-dark">{label}</span>}
        <input
          aria-label={label ? undefined : inputProps.placeholder}
          aria-invalid={Boolean(error)}
          className="w-full bg-transparent py-1 text-slate-800 outline-none placeholder:text-slate-400"
          {...inputProps}
        />
      </label>
      <FieldMessage error={error} hint={hint} />
    </div>
  )
}

export default Field
