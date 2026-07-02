import { useQuery } from '@tanstack/react-query'

import { fetchThought } from '../api/client.js'

/**
 * @param {string | undefined} id
 */
export function useThought(id) {
  return useQuery({
    queryKey: ['thought', id],
    queryFn: () => fetchThought(id),
    enabled: Boolean(id),
  })
}
