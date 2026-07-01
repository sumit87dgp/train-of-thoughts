function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''
  if (!baseUrl) {
    throw new Error('VITE_API_URL is not set. Copy .env.example to .env in tot-frontend/.')
  }
  return baseUrl
}

export async function fetchHealth() {
  const response = await fetch(`${getApiBaseUrl()}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`)
  }
  return response.json()
}
