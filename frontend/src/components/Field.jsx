// Text input in a rounded box. With a label it matches the login design (small label above
// the value), without one it is a plain placeholder box like the register design.
function Field({ label, ...inputProps }) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-5 py-3 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
      {label && <span className="block text-xs font-semibold text-primary-dark">{label}</span>}
      <input
        aria-label={label ? undefined : inputProps.placeholder}
        className="w-full bg-transparent py-1 text-slate-800 outline-none placeholder:text-slate-400"
        {...inputProps}
      />
    </label>
  )
}

export default Field
