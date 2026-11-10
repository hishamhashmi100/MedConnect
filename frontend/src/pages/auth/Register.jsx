import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AuthHeading from '../../components/AuthHeading'
import AuthLayout from '../../components/AuthLayout'
import DemoLink from '../../components/DemoLink'
import DoctorDetailsFields from '../../components/DoctorDetailsFields'
import Field from '../../components/Field'
import PrimaryButton from '../../components/PrimaryButton'
import RoleToggle from '../../components/RoleToggle'
import { doctorDetailsPayload, EMPTY_DOCTOR_DETAILS } from '../../utils/doctorDetails'
import {
  checkConfirmPassword,
  checkEmail,
  checkFullName,
  checkNewPassword,
  doctorDetailsErrors,
  useFieldErrors,
} from '../../utils/validation'

const ROLE_TEXT = {
  patient: {
    eyebrow: 'Patient sign up',
    subtitle: 'Book verified doctors across Karachi.',
    nameHint: '',
  },
  doctor: {
    eyebrow: 'Doctor sign up',
    subtitle:
      'Give your PMDC details so our admin team can verify you. After you confirm your email you add your clinics, fees and weekly hours.',
    nameHint: 'Your name as it appears on your PMDC certificate.',
  },
}

function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState(searchParams.get('as') === 'doctor' ? 'doctor' : 'patient')
  const [account, setAccount] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [details, setDetails] = useState(EMPTY_DOCTOR_DETAILS)
  const [specialties, setSpecialties] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    client
      .get('/meta/specialties')
      .then((response) => setSpecialties(response.data))
      .catch((err) => setError(getErrorMessage(err)))
  }, [])

  const errors = {
    fullName: checkFullName(account.fullName),
    email: checkEmail(account.email),
    password: checkNewPassword(account.password),
    confirmPassword: checkConfirmPassword(account.confirmPassword, account.password),
    ...(role === 'doctor' ? doctorDetailsErrors(details) : {}),
  }
  const { show, touch, checkAll } = useFieldErrors(errors)

  function updateAccount(field, value) {
    setAccount((current) => ({ ...current, [field]: value }))
  }

  function updateDetails(field, value) {
    setDetails((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!checkAll()) {
      setError('Please correct the fields marked in red.')
      return
    }

    const email = account.email.trim()
    setSubmitting(true)
    try {
      await client.post('/auth/register', {
        full_name: account.fullName.trim(),
        email,
        password: account.password,
        role,
        doctor_profile: role === 'doctor' ? doctorDetailsPayload(details) : null,
      })
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`)
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  const text = ROLE_TEXT[role]

  return (
    <AuthLayout>
      <AuthHeading eyebrow={text.eyebrow} title="Join MedConnect PK" subtitle={text.subtitle} />

      <div className="mt-8">
        <RoleToggle value={role} onChange={setRole} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <Field
          placeholder="Full name"
          value={account.fullName}
          onChange={(event) => updateAccount('fullName', event.target.value)}
          onBlur={() => touch('fullName')}
          error={show('fullName')}
          hint={text.nameHint}
          autoComplete="name"
          maxLength={100}
        />
        <Field
          placeholder="Email address"
          type="email"
          value={account.email}
          onChange={(event) => updateAccount('email', event.target.value)}
          onBlur={() => touch('email')}
          error={show('email')}
          autoComplete="email"
        />
        <Field
          placeholder="Password"
          type="password"
          value={account.password}
          onChange={(event) => updateAccount('password', event.target.value)}
          onBlur={() => touch('password')}
          error={show('password')}
          hint="At least 8 characters, with a letter and a number."
          autoComplete="new-password"
          maxLength={72}
        />
        <Field
          placeholder="Confirm password"
          type="password"
          value={account.confirmPassword}
          onChange={(event) => updateAccount('confirmPassword', event.target.value)}
          onBlur={() => touch('confirmPassword')}
          error={show('confirmPassword')}
          autoComplete="new-password"
          maxLength={72}
        />

        {role === 'doctor' && (
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <div>
              <p className="text-lg font-bold text-primary-dark">Professional details</p>
              <p className="text-sm text-slate-500">
                Patients see these details once the admin team approves your profile.
              </p>
            </div>
            <DoctorDetailsFields
              form={details}
              update={updateDetails}
              show={show}
              touch={touch}
              specialties={specialties}
            />
          </div>
        )}

        {error && <Alert>{error}</Alert>}
        <div className="pt-2">
          <PrimaryButton disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </PrimaryButton>
        </div>
      </form>

      <p className="mt-7 text-center text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-primary hover:text-primary-dark">
          Log in
        </Link>
      </p>
      <DemoLink />
    </AuthLayout>
  )
}

export default Register
