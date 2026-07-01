import { useEffect, useState } from 'react'

import { fetchHealth } from '../api/client.js'

export default function HealthCheck() {
  const [state, setState] = useState({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetchHealth()
      .then((data) => {
        if (!cancelled) {
          setState({ kind: 'ok', data })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Health check failed',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <div className="health-panel" aria-live="polite">
        <p className="health-panel__status">
          <span className="spinner" aria-hidden="true" />
          Checking API health…
        </p>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="health-panel health-panel--error" aria-live="polite">
        <p className="health-panel__label">API status</p>
        <p className="health-panel__status health-panel__status--error">
          {state.message}
        </p>
        <p className="health-panel__hint">
          Ensure Docker Postgres and the backend are running (
          <code>fastapi dev app/main.py --port 8000</code>).
        </p>
      </div>
    )
  }

  return (
    <div className="health-panel health-panel--ok" aria-live="polite">
      <p className="health-panel__label">API status</p>
      <p className="health-panel__status health-panel__status--ok">
        {state.data.status}
      </p>
      <dl className="health-panel__details">
        <div className="health-panel__row">
          <dt>Endpoint</dt>
          <dd>
            <code>GET /health</code>
          </dd>
        </div>
        <div className="health-panel__row">
          <dt>Database</dt>
          <dd>Connected (pool ping via API)</dd>
        </div>
      </dl>
    </div>
  )
}
