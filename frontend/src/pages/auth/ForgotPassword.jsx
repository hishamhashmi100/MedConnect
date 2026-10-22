import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AuthHeading from '../../components/AuthHeading'
import AuthLayout from '../../components/AuthLayout'
import Field from '../../components/Field'
import PrimaryButton from '../../components/PrimaryButton'

function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await client.post('/auth/forgot-password', { email })
      navigate(`/reset-password?email=${encodeURIComponent(email)}`)
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <AuthHeading
        eyebrow="Password reset"
        title="Forgot your password?"
        subtitle="Enter your account email and we will send you a 6-digit code to set a new password."
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <div className="pt-2">
          <PrimaryButton disabled={submitting}>
            {submitting ? 'Sending code...' : 'Send code'}
          </PrimaryButton>
        </div>
      </form>

      <p className="mt-7 text-center text-slate-500">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-primary hover:text-primary-dark">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  )
}

export default ForgotPassword
