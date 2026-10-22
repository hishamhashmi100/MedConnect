import { HeartPlus } from 'lucide-react'

function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
          light ? 'bg-white text-primary' : 'bg-primary text-white'
        }`}
      >
        <HeartPlus size={22} />
      </span>
      <span
        className={`text-2xl font-bold tracking-tight ${light ? 'text-white' : 'text-primary-dark'}`}
      >
        MedConnect<sup className="ml-0.5 text-xs font-semibold">PK</sup>
      </span>
    </div>
  )
}

export default Logo
