// Dropdown with the same boxed label style as Field
function SelectField({ label, children, ...selectProps }) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-5 py-3 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
      <span className="block text-xs font-semibold text-primary-dark">{label}</span>
      <select className="w-full bg-transparent py-1 text-slate-800 outline-none" {...selectProps}>
        {children}
      </select>
    </label>
  )
}

export default SelectField
