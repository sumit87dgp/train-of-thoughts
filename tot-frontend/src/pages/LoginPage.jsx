import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth.js'
import { isAuthenticated } from '../lib/auth.js'

export default function LoginPage() {
  const { login, isSubmitting, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await login(username.trim(), password)
  }

  return (
    <main className="page page--center">
      <section className="login-card">
        <header className="login-card__header">
          <h1 className="login-card__title">Sign in</h1>
          <p className="login-card__lead">
            Train of Thoughts — your personal idea notebook.
          </p>
        </header>

        <form className="login-card__form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="input"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="field-error">{error}</p> : null}

          <button
            type="submit"
            className="btn btn-primary login-card__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
