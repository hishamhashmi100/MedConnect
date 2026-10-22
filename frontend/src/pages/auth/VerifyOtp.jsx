import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, ShieldCheck } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import AuthHeading from '../../components/AuthHeading'
import AuthLayout from '../../components/AuthLayout'
import OtpInput from '../../components/OtpInput'
import PrimaryButton from '../../components/PrimaryButton'
import ResendCode from '../../components/ResendCode'
import { useAuth } from '../../context/AuthContext'
import { homePathFor, maskEmail } from '../../utils/format'

function VerifyOtp() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!email) return <Navigate to="/login" replace />

  const code = digits.join('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await client.post('/auth/verify-otp', { email, code })
      // A new account stays logged in on this device, the same as "Remember me" being on
      login(response.data.token, response.data.user, true)
      navigate(homePathFor(response.data.user.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-mint text-primary">
        <Mail size={32} />
      </div>
      <AuthHeading eyebrow="Email verification" title="Check your inbox" centered />
      <p className="mt-4 text-center text-lg text-slate-500">
        Enter the 6-digit code sent to{' '}
        <span className="font-semibold text-slate-600">{maskEmail(email)}</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <OtpInput digits={digits} onChange={setDigits} />
        <ResendCode email={email} purpose="verify" />
        {error && <Alert>{error}</Alert>}
        <PrimaryButton disabled={code.length < 6 || submitting}>
          {submitting ? 'Verifying...' : 'Verify & Continue'}
        </PrimaryButton>
      </form>

      <div className="mt-6 flex justify-center">
        <span className="flex items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-semibold text-primary-dark">
          <ShieldCheck size={16} /> Your email keeps your account secure
        </span>
      </div>
    </AuthLayout>
  )
}

export default VerifyOtp
