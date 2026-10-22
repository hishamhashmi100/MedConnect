import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AuthHeading from '../../components/AuthHeading'
import AuthLayout from '../../components/AuthLayout'
import Field from '../../components/Field'
import OtpInput from '../../components/OtpInput'
import PrimaryButton from '../../components/PrimaryButton'
import ResendCode from '../../components/ResendCode'
import { maskEmail } from '../../utils/format'

function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!email) return <Navigate to="/forgot-password" replace />

  const code = digits.join('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const response = await client.post('/auth/reset-password', {
        email,
        code,
        new_password: newPassword,
      })
      navigate('/login', { replace: true, state: { notice: response.data.message } })
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-mint text-primary">
        <KeyRound size={32} />
      </div>
      <AuthHeading eyebrow="Password reset" title="Set a new password" centered />
      <p className="mt-4 text-center text-lg text-slate-500">
        Enter the 6-digit code sent to{' '}
        <span className="font-semibold text-slate-600">{maskEmail(email)}</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <OtpInput digits={digits} onChange={setDigits} />
        <ResendCode email={email} purpose="reset" />
        {error && <Alert>{error}</Alert>}
        <Field
          label="New password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <div className="pt-1">
          <PrimaryButton disabled={code.length < 6 || submitting}>
            {submitting ? 'Updating...' : 'Update password'}
          </PrimaryButton>
        </div>
      </form>

      <p className="mt-7 text-center text-slate-500">
        <Link to="/login" className="font-semibold text-primary hover:text-primary-dark">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  )
}

export default ResetPassword
