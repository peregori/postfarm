import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setAuthTokenGetter } from '../api/client'

/**
 * AuthProvider sets up the API client to use Clerk's auth token.
 * Must be rendered inside ClerkProvider.
 */
export function AuthProvider({ children }) {
  const { getToken } = useAuth()

  useEffect(() => {
    // Set the token getter for the API client
    setAuthTokenGetter(getToken)

    // Cleanup on unmount
    return () => {
      setAuthTokenGetter(null)
    }
  }, [getToken])

  return children
}
