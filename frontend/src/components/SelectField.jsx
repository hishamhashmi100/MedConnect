import FieldMessage from './FieldMessage'

// Dropdown with the same boxed label style as Field
function SelectField({ label, error, hint, children, ...selectProps }) {
  return (
    <div>
      <label
        className={`block rounded-2xl border bg-white px-5 py-3 transition focus-within:ring-4 ${
          error
            ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-100'
            : 'border-slate-200 focus-within:border-primary focus-within:ring-primary/10'
        }`}
      >
        <span className="block text-xs font-semibold text-primary-dark">{label}</span>
        <select
          aria-invalid={Boolean(error)}
          className="w-full bg-transparent py-1 text-slate-800 outline-none"
          {...selectProps}
        >
          {children}
        </select>
      </label>
      <FieldMessage error={error} hint={hint} />
    </div>
  )
}

export default SelectField
