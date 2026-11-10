// The doctor's professional details form, shared by sign up and the profile page.
// Clinics, fees and weekly hours are set after sign up, on their own pages.

export const EMPTY_DOCTOR_DETAILS = {
  specialty: '',
  pmdc_number: '',
  experience_years: '',
}

// What the API expects: a tidy PMDC number and the years as a number
export function doctorDetailsPayload(form) {
  return {
    ...form,
    pmdc_number: form.pmdc_number.trim().toUpperCase(),
    experience_years: Number(form.experience_years),
  }
}
