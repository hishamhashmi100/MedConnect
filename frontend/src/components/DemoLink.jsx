import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Alert from './Alert'

// One-click login as the seeded demo patient. Hidden unless VITE_DEMO_MODE is "true".
function DemoLink() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (import.meta.env.VITE_DEMO_MODE !== 'true') return null

  async function handleClick() {
    setError('')
    setLoading(true)
    try {
      const response = await client.post('/auth/demo')
      // The demo login only lasts for this tab
      login(response.data.token, response.data.user, false)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="font-semibold text-primary hover:text-primary-dark disabled:opacity-60"
      >
        {loading ? 'Opening demo...' : 'Explore the patient demo →'}
      </button>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

export default DemoLink
