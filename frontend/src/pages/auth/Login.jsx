import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Mail, ShieldCheck } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AuthHeading from '../../components/AuthHeading'
import AuthLayout from '../../components/AuthLayout'
import DemoLink from '../../components/DemoLink'
import Field from '../../components/Field'
import PrimaryButton from '../../components/PrimaryButton'
import RoleToggle from '../../components/RoleToggle'
import { useAuth } from '../../context/AuthContext'
import { homePathFor } from '../../utils/format'
import { checkEmail, checkRequired, useFieldErrors } from '../../utils/validation'

// Patients log in on the Patient tab and doctors on the Provider tab; the server refuses an
// account on the wrong tab. Admins can use either, and land on the page for the role the
// server returns.
const PORTAL_TEXT = {
  patient: {
    eyebrow: 'Secure patient portal',
    subtitle: 'One account to find and book verified doctors.',
    registerLabel: 'Register as Patient',
    registerPath: '/register',
  },
  doctor: {
    eyebrow: 'Secure provider portal',
    subtitle: 'Manage your profile, availability and appointments.',
    registerLabel: 'Register as Provider',
    registerPath: '/register?as=doctor',
  },
}

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [portal, setPortal] = useState('patient')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const text = PORTAL_TEXT[portal]
  const expired = new URLSearchParams(location.search).has('expired')
  const notice =
    location.state?.notice ?? (expired ? 'Your session has expired. Please log in again.' : '')

  const { show, touch, checkAll } = useFieldErrors({
    email: checkEmail(email),
    password: checkRequired(password, 'Please enter your password.'),
  })

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!checkAll()) return

    setSubmitting(true)
    try {
      const response = await client.post('/auth/login', {
        email: email.trim(),
        password,
        role: portal,
      })
      login(response.data.token, response.data.user, remember)
      navigate(homePathFor(response.data.user.role), { replace: true })
    } catch (err) {
      if (err.response?.data?.detail?.needs_verification) {
        navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`)
        return
      }
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <AuthHeading eyebrow={text.eyebrow} title="Welcome back" subtitle={text.subtitle} />

      <div className="mt-8">
        <RoleToggle
          value={portal}
          onChange={(value) => {
            setPortal(value)
            setError('')
          }}
        />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        {notice && <Alert type="success">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}

        <Field
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => touch('email')}
          error={show('email')}
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => touch('password')}
          error={show('password')}
          autoComplete="current-password"
          maxLength={72}
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-3 text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="font-semibold text-primary hover:text-primary-dark"
          >
            Forgot password?
          </Link>
        </div>

        <div className="pt-2">
          <PrimaryButton disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log In'}
          </PrimaryButton>
        </div>
      </form>

      <p className="mt-7 text-center text-slate-500">
        New to MedConnect PK?{' '}
        <Link to={text.registerPath} className="font-semibold text-primary hover:text-primary-dark">
          {text.registerLabel}
        </Link>
      </p>
      <DemoLink />

      <div className="mt-8 flex flex-wrap justify-center gap-3 border-t border-slate-200 pt-7">
        <span className="flex items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-semibold text-primary-dark">
          <Mail size={16} /> Secure OTP Login
        </span>
        <span className="flex items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-semibold text-primary-dark">
          <ShieldCheck size={16} /> Admin Approved Providers
        </span>
      </div>
    </AuthLayout>
  )
}

export default Login
