import { useState } from 'react'

// Each check returns an error message, or '' when the value is fine. The rules match the
// backend schemas, so the server only rejects what the form can't know (like a taken email).

export function checkFullName(value) {
  const name = value
    .trim()
    .replace(/^dr\.?\s+/i, '')
    .replace(/\s+/g, ' ')
  if (!name) return 'Please enter your full name.'
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) {
    return 'Name can only contain letters, spaces, dots, hyphens and apostrophes.'
  }
  if (name.length < 3) return 'Please enter your full name.'
  if (name.length > 100) return 'Name must be 100 characters or less.'
  return ''
}

export function checkEmail(value) {
  const email = value.trim()
  if (!email) return 'Please enter your email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Please enter a valid email address, like name@example.com.'
  }
  return ''
}

export function checkNewPassword(value) {
  if (!value) return 'Please enter a password.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  // bcrypt only uses the first 72 bytes
  if (value.length > 72) return 'Password must be 72 characters or less.'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must contain at least one letter and one number.'
  }
  return ''
}

export function checkConfirmPassword(value, password) {
  if (!value) return 'Please type the password again.'
  if (value !== password) return 'Passwords do not match.'
  return ''
}

export function checkRequired(value, message) {
  return String(value).trim() ? '' : message
}

export function checkReason(value) {
  const reason = value.trim()
  if (!reason) return 'Please give a reason.'
  if (reason.length < 5) return 'Please write at least 5 characters.'
  if (reason.length > 500) return 'Please keep it under 500 characters.'
  return ''
}

function checkExperience(value) {
  if (String(value).trim() === '') return 'Please enter your years of experience.'
  const years = Number(value)
  if (!Number.isInteger(years)) return 'Please enter whole years, for example 5.'
  if (years < 0 || years > 60) return 'Years of experience must be between 0 and 60.'
  return ''
}

export function checkFee(value) {
  if (String(value).trim() === '') return 'Please enter the fee.'
  if (!Number.isInteger(Number(value))) return 'Please enter the fee in whole rupees.'
  if (Number(value) < 100 || Number(value) > 50000) {
    return 'Fee must be between Rs. 100 and Rs. 50,000.'
  }
  return ''
}

// Errors for the doctor's professional details, used on sign up and on the profile page
export function doctorDetailsErrors(form) {
  const errors = {
    specialty: form.specialty ? '' : 'Please choose your specialty.',
    pmdc_number: '',
    experience_years: checkExperience(form.experience_years),
  }

  const pmdc = form.pmdc_number.trim()
  if (!pmdc) errors.pmdc_number = 'Please enter your PMDC registration number.'
  else if (!/^\d{3,7}-[A-Za-z]$/.test(pmdc)) {
    errors.pmdc_number = 'PMDC number should look like 12345-P (digits, a dash, then a letter).'
  }
  return errors
}

// Errors for one clinic on the Clinics and fees page
export function clinicErrors(clinic) {
  const name = clinic.name.trim()
  const area = clinic.area.trim()
  return {
    name: !name
      ? 'Please enter the clinic or hospital name.'
      : name.length < 3
        ? 'Please enter the full name.'
        : '',
    area: !area
      ? 'Please enter the area, for example Clifton.'
      : area.length < 3
        ? 'Please enter the full area name.'
        : '',
    address:
      clinic.address.trim().length < 10
        ? 'Please enter the full address, with building, block and area.'
        : '',
    fee: checkFee(clinic.fee),
  }
}

export function hasErrors(errors) {
  return Object.values(errors).some(Boolean)
}

// Shows a field's error once the user has left the field, or for every field after the
// first submit. errors is worked out from the current values on every render.
export function useFieldErrors(errors) {
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)

  function show(field) {
    return submitted || touched[field] ? errors[field] || '' : ''
  }

  function touch(field) {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }

  // Call on submit: returns true when the form can be sent
  function checkAll() {
    setSubmitted(true)
    return !hasErrors(errors)
  }

  return { show, touch, checkAll }
}
