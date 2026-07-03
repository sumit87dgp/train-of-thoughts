import { useQuery } from '@tanstack/react-query'

import { searchThoughts } from '../api/client.js'

/**
 * @param {string} q
 * @param {number} [limit]
 * @param {number} [offset]
 */
export function useSearchThoughts(q, limit = 20, offset = 0) {
  const trimmed = q.trim()

  return useQuery({
    queryKey: ['thoughts', 'search', { q: trimmed, limit, offset }],
    queryFn: () => searchThoughts(trimmed, { limit, offset }),
    enabled: trimmed.length > 0,
  })
}
