import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AuthHeading from '../../components/AuthHeading'
import AuthLayout from '../../components/AuthLayout'
import Field from '../../components/Field'
import FieldMessage from '../../components/FieldMessage'
import OtpInput from '../../components/OtpInput'
import PrimaryButton from '../../components/PrimaryButton'
import ResendCode from '../../components/ResendCode'
import { maskEmail } from '../../utils/format'
import { checkConfirmPassword, checkNewPassword, useFieldErrors } from '../../utils/validation'

function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const code = digits.join('')
  const { show, touch, checkAll } = useFieldErrors({
    code: code.length === 6 ? '' : 'Please enter all 6 digits of the code.',
    newPassword: checkNewPassword(newPassword),
    confirmPassword: checkConfirmPassword(confirmPassword, newPassword),
  })

  if (!email) return <Navigate to="/forgot-password" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!checkAll()) return

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

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <OtpInput digits={digits} onChange={setDigits} />
          <div className="text-center">
            <FieldMessage error={show('code')} />
          </div>
        </div>
        <ResendCode email={email} purpose="reset" />
        {error && <Alert>{error}</Alert>}
        <Field
          label="New password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          onBlur={() => touch('newPassword')}
          error={show('newPassword')}
          hint="At least 8 characters, with a letter and a number."
          autoComplete="new-password"
          maxLength={72}
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onBlur={() => touch('confirmPassword')}
          error={show('confirmPassword')}
          autoComplete="new-password"
          maxLength={72}
        />
        <div className="pt-1">
          <PrimaryButton disabled={submitting}>
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
