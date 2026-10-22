// One badge for doctor approval statuses and appointment statuses
const STYLES = {
  pending: { label: 'Pending', className: 'bg-pending text-pending-text' },
  approved: { label: 'Approved', className: 'bg-mint text-primary-dark' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
  confirmed: { label: 'Confirmed', className: 'bg-mint text-primary-dark' },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700' },
}

function StatusBadge({ status }) {
  const style = STYLES[status]
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  )
}

export default StatusBadge
