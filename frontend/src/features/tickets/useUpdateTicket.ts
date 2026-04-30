import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateTicketPayload } from '@/shared/types'
import { updateTicket } from '@/shared/api/api'

export function useUpdateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateTicketPayload) =>
      updateTicket(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
