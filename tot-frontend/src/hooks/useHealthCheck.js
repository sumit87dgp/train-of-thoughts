import { useQuery } from '@tanstack/react-query'

import { fetchHealth } from '../api/client.js'

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  })
}
