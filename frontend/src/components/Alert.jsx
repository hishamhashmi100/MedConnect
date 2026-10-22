function Alert({ type = 'error', children }) {
  const colours = type === 'error' ? 'bg-red-50 text-red-700' : 'bg-mint text-primary-dark'
  return <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${colours}`}>{children}</p>
}

export default Alert
