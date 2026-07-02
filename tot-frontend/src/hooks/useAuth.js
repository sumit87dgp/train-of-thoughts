import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { login as loginApi } from '../api/client.js'
import { clearToken, isAuthenticated, setToken } from '../lib/auth.js'

export function useAuth() {
  const navigate = useNavigate()
  const location = useLocation()

  const loginMutation = useMutation({
    mutationFn: ({ username, password }) => loginApi(username, password),
    onSuccess: (data) => {
      setToken(data.access_token)
      const redirectTo = location.state?.from?.pathname ?? '/'
      navigate(redirectTo, { replace: true })
    },
  })

  const login = useCallback(
    (username, password) => {
      loginMutation.reset()
      loginMutation.mutate({ username, password })
    },
    [loginMutation],
  )

  const logout = useCallback(() => {
    clearToken()
    navigate('/login', { replace: true })
  }, [navigate])

  const error =
    loginMutation.error instanceof Error ? loginMutation.error.message : null

  return {
    login,
    logout,
    isSubmitting: loginMutation.isPending,
    error,
    isAuthenticated: isAuthenticated(),
  }
}
