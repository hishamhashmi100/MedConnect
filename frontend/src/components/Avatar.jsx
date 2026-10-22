import { initials } from '../utils/format'

const SIZES = {
  md: 'h-11 w-11 rounded-2xl text-sm',
  lg: 'h-14 w-14 rounded-2xl text-lg',
  xl: 'h-20 w-20 rounded-full text-2xl sm:h-24 sm:w-24',
}

function Avatar({ name, size = 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-linear-to-br from-mint to-teal-soft/40 font-bold text-primary-dark ${SIZES[size]}`}
    >
      {initials(name)}
    </span>
  )
}

export default Avatar
