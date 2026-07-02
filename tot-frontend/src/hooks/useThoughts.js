import { useQuery } from '@tanstack/react-query'

import { fetchThoughts } from '../api/client.js'

/**
 * @param {number} [limit]
 * @param {number} [offset]
 * @param {string | null | undefined} [tag]
 */
export function useThoughts(limit = 20, offset = 0, tag = undefined) {
  return useQuery({
    queryKey: ['thoughts', { limit, offset, tag }],
    queryFn: () => fetchThoughts({ limit, offset, tag }),
  })
}
