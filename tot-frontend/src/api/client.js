import { getToken, clearToken } from '../lib/auth.js'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''
  if (!baseUrl) {
    throw new Error('VITE_API_URL is not set. Copy .env.example to .env in tot-frontend/.')
  }
  return baseUrl
}

async function parseApiError(response) {
  let detail = `Request failed (${response.status})`
  try {
    const body = await response.json()
    if (body.detail) {
      detail =
        typeof body.detail === 'string'
          ? body.detail
          : JSON.stringify(body.detail)
    }
  } catch {
    // ignore non-JSON error bodies
  }
  const error = new Error(detail)
  error.status = response.status
  throw error
}

function handleUnauthorized() {
  clearToken()
  window.location.assign('/login')
}

/**
 * @param {string} path
 * @param {RequestInit & { auth?: boolean }} [options]
 * @param {boolean} [options.auth] Attach Bearer token when true (default). Set false for login.
 */
export async function apiFetch(path, options = {}) {
  const { auth = true, headers, ...rest } = options
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (auth) {
    const token = getToken()
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: requestHeaders,
  })

  if (response.status === 401 && auth) {
    handleUnauthorized()
    throw new Error('Session expired. Please sign in again.')
  }

  if (!response.ok) {
    await parseApiError(response)
  }

  if (response.status === 204) {
    return undefined
  }

  return response.json()
}

export async function fetchHealth() {
  return apiFetch('/health', { auth: false })
}

export async function login(username, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchMe() {
  return apiFetch('/api/auth/me')
}
