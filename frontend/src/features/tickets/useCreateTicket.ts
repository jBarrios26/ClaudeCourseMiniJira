import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TicketFormValues } from './ticketSchema'
import { createTicket } from '@/shared/api/api'
import { useProjectStore } from '@/shared/stores/projectStore'

export function useCreateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TicketFormValues) => {
      const projectId = useProjectStore.getState().activeProjectId
      return createTicket({ ...payload, projectId: projectId ?? undefined })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
