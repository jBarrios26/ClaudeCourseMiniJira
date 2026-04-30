import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createComment } from '@/shared/api/api'

export function useCreateComment(ticketId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: string) => createComment(ticketId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] })
    },
  })
}
