import { useMutation, useQueryClient } from '@tanstack/react-query'
import { restoreTicket } from '@/shared/api/api'

export function useRestoreTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => restoreTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
