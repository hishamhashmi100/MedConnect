import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AuthHeading from '../../components/AuthHeading'
import AuthLayout from '../../components/AuthLayout'
import DemoLink from '../../components/DemoLink'
import Field from '../../components/Field'
import PrimaryButton from '../../components/PrimaryButton'
import RoleToggle from '../../components/RoleToggle'

const ROLE_TEXT = {
  patient: {
    eyebrow: 'Patient sign up',
    subtitle: 'Book verified doctors across Karachi.',
  },
  doctor: {
    eyebrow: 'Doctor sign up',
    subtitle: 'For doctors who want to offer clinic and home visit appointments.',
  },
}

function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState(searchParams.get('as') === 'doctor' ? 'doctor' : 'patient')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await client.post('/auth/register', { full_name: fullName, email, password, role })
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`)
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <AuthHeading
        eyebrow={ROLE_TEXT[role].eyebrow}
        title="Join MedConnect PK"
        subtitle={ROLE_TEXT[role].subtitle}
      />

      <div className="mt-8">
        <RoleToggle value={role} onChange={setRole} />
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field
          placeholder="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
          required
        />
        <Field
          placeholder="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <Field
          placeholder="Password (at least 8 characters)"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <Field
          placeholder="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

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
