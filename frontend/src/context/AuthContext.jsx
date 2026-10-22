import { createContext, useContext, useEffect, useState } from 'react'
import client, { clearToken, getToken, saveToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Only wait for /auth/me if there is a saved token to check
  const [loading, setLoading] = useState(Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) return
    client
      .get('/auth/me')
      .then((response) => setUser(response.data))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  function login(token, userData, remember) {
    saveToken(token, remember)
    setUser(userData)
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
