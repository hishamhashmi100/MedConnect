// A doctor can see patients at several clinics and also do home visits.
// These helpers turn the API data into the "places" patients choose from.

// Every place a doctor can be booked at: each clinic with weekly hours, then home visits
export function bookingPlaces(doctor) {
  const places = doctor.clinics.map((clinic) => ({
    key: `clinic-${clinic.id}`,
    type: 'clinic',
    clinicId: clinic.id,
    label: clinic.name,
    // Finishes a sentence like "Dr. Ayesha Siddiqui is ... on Monday"
    where: `at ${clinic.name}`,
    detail: clinic.address,
    fee: clinic.fee,
    days: clinic.days,
  }))
  if (doctor.offers_home_visit) {
    places.push({
      key: 'home',
      type: 'home',
      clinicId: null,
      label: 'Home visit',
      where: 'doing home visits',
      detail: 'The doctor comes to your address',
      fee: doctor.home_visit_fee,
      days: doctor.home_visit_days,
    })
  }
  return places
}

// The place an existing appointment is at, or undefined if the doctor no longer offers it
export function placeOfAppointment(doctor, appointment) {
  const key = appointment.consultation_type === 'home' ? 'home' : `clinic-${appointment.clinic?.id}`
  return bookingPlaces(doctor).find((place) => place.key === key)
}

// Short name of where an appointment is, for lists
export function appointmentPlaceName(appointment) {
  if (appointment.consultation_type === 'home') return 'Home visit'
  return appointment.clinic?.name ?? 'In-clinic visit'
}

// Full sentence with the address, for appointment details
export function appointmentPlaceText(appointment) {
  if (appointment.consultation_type === 'home') {
    return `Home visit at ${appointment.home_address}`
  }
  if (!appointment.clinic) return 'In-clinic visit (the doctor no longer lists this clinic)'
  return `At ${appointment.clinic.name}, ${appointment.clinic.address}`
}
