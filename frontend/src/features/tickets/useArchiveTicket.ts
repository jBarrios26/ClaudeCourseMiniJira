import { useMutation, useQueryClient } from '@tanstack/react-query'
import { archiveTicket } from '@/shared/api/api'

export function useArchiveTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => archiveTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
