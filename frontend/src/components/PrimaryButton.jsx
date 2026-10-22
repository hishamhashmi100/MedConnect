// Full width on the auth pages; set wide={false} for a normal sized button inside a page
function PrimaryButton({ children, type = 'submit', wide = true, ...props }) {
  return (
    <button
      type={type}
      className={`rounded-2xl bg-primary py-4 font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 ${
        wide ? 'w-full' : 'px-10'
      }`}
      {...props}
    >
      {children}
    </button>
  )
}

export default PrimaryButton
