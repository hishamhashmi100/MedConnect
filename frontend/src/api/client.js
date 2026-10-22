import axios from 'axios'

const TOKEN_KEY = 'medconnect_token'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

// With "Remember me" the token survives closing the browser, otherwise it only lasts for this tab
export function saveToken(token, remember) {
  clearToken()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// The API sends errors in a few shapes (plain text, an object, or a list from field validation)
export function getErrorMessage(error) {
  if (!error.response) {
    return 'Could not reach the server. Please check your connection and try again.'
  }
  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message
  // Our own checks in the schemas come back as "Value error, <our message>"
  if (Array.isArray(detail) && detail.length > 0) return detail[0].msg.replace(/^Value error, /, '')
  return 'Something went wrong. Please try again.'
}

// For things that may not exist yet (like a new doctor's profile): a 404 becomes null
export function notFoundAsNull(error) {
  if (error.response?.status === 404) return null
  throw error
}

export default client
