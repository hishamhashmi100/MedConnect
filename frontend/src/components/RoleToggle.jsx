// Provider means doctor in this build
const OPTIONS = [
  { value: 'patient', label: 'Patient' },
  { value: 'doctor', label: 'Provider' },
]

function RoleToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 rounded-full bg-mint p-1.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full py-3 font-semibold transition ${
            value === option.value
              ? 'bg-white text-primary-dark shadow-sm'
              : 'text-slate-500 hover:text-primary-dark'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default RoleToggle
