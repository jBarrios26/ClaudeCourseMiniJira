import { useQuery } from '@tanstack/react-query'
import { fetchComments } from '@/shared/api/api'

export function useComments(ticketId: string) {
  return useQuery({
    queryKey: ['comments', ticketId],
    queryFn: () => fetchComments(ticketId),
    enabled: !!ticketId,
  })
}
