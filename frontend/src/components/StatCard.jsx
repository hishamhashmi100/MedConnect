function StatCard({ label, value, note }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <p className="text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-bold text-primary-dark">{value}</p>
      {note && <p className="mt-3 text-primary">{note}</p>}
    </div>
  )
}

export default StatCard
