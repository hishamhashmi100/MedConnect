import { useEffect, useState } from 'react'
import client, { getErrorMessage } from '../api/client'

// Matches the 60 second wait the backend enforces between codes
const WAIT_SECONDS = 60

function ResendCode({ email, purpose }) {
  const [seconds, setSeconds] = useState(WAIT_SECONDS)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (seconds === 0) return
    const timer = setTimeout(() => setSeconds(seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  async function handleResend() {
    setSending(true)
    setMessage('')
    try {
      const response = await client.post('/auth/resend-otp', { email, purpose })
      setMessage(response.data.message)
      setSeconds(WAIT_SECONDS)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSending(false)
    }
  }

  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  return (
    <div className="text-center text-sm text-slate-500">
      {seconds > 0 ? (
        <p>
          Resend code in {minutes}:{secs}
        </p>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="font-semibold text-primary hover:text-primary-dark disabled:opacity-60"
        >
          {sending ? 'Sending...' : 'Resend code'}
        </button>
      )}
      {message && <p className="mt-1 text-primary-dark">{message}</p>}
    </div>
  )
}

export default ResendCode
