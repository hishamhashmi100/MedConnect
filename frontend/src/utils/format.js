// Index matches day_of_week on the backend (0 = Monday)
export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// Where each role lands after logging in
export function homePathFor(role) {
  if (role === 'doctor') return '/doctor'
  if (role === 'admin') return '/admin'
  return '/'
}

// "ahmed.raza@gmail.com" becomes "a••••@gmail.com"
export function maskEmail(email) {
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name[0]}••••@${domain}`
}

export function formatLongDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  })
}

export function firstName(fullName) {
  return fullName.trim().split(' ')[0]
}

// Names are stored without "Dr.", but some doctors may type it in themselves
export function doctorName(fullName) {
  return /^dr\.?\s/i.test(fullName) ? fullName : `Dr. ${fullName}`
}

// "Dr. Ayesha Siddiqui" becomes "AS"
export function initials(fullName) {
  return fullName
    .replace(/^dr\.?\s/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

// "17:30:00" or "17:30" becomes "5:30 PM"
export function formatTime(value) {
  const [hours, minutes] = value.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

// "2026-10-12T09:30:00" becomes "12 Oct"
export function formatShortDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

// "2026-10-21T17:30:00" becomes "Today, 5:30 PM", "Tomorrow, 10:00 AM" or "Thu 23 Oct, 9:00 AM"
export function formatSlot(value) {
  const slot = new Date(value)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  let day
  if (sameDay(slot, today)) day = 'Today'
  else if (sameDay(slot, tomorrow)) day = 'Tomorrow'
  else day = slot.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day}, ${formatTime(value.slice(11, 16))}`
}

// Dates go to the API as "YYYY-MM-DD" in local time. toISOString() would use UTC and can
// shift the day near midnight in Pakistan.
export function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function fromDateKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// JavaScript counts Sunday as 0; the backend counts Monday as 0
export function mondayIndex(date) {
  return (date.getDay() + 6) % 7
}

// "2026-10-21" becomes "Wednesday, 21 October"
export function formatDateKey(key) {
  return fromDateKey(key).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// "2026-10-13" becomes "Tue, 13 Oct"
export function formatShortDay(key) {
  const day = fromDateKey(key)
  const weekday = day.toLocaleDateString('en-GB', { weekday: 'short' })
  const rest = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${weekday}, ${rest}`
}

// When an appointment starts, as a local Date
export function appointmentStart(appointment) {
  return new Date(`${appointment.date}T${appointment.start_time}`)
}

// Only confirmed appointments that haven't started can still be changed
export function isUpcoming(appointment, now) {
  return appointment.status === 'confirmed' && appointmentStart(appointment) > now
}

// Time left until a date, for example "1 day, 4 hours" or "35 minutes"
export function formatTimeUntil(target, now) {
  const minutes = Math.floor((target - now) / 60000)
  if (minutes < 1) return 'Starting now'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
  if (days > 0) return `${plural(days, 'day')}, ${plural(hours, 'hour')}`
  if (hours > 0) return `${plural(hours, 'hour')}, ${plural(mins, 'minute')}`
  return plural(mins, 'minute')
}

export function formatFee(amount) {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}
