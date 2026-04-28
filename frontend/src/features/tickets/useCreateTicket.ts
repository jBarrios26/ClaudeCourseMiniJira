import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Ticket } from '@/shared/types'
import type { TicketFormValues } from './ticketSchema'
import { useAuthStore } from '@/shared/stores/authStore'

export function useCreateTicket() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async (payload: TicketFormValues) => {
      if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        
        // Mock a newly created ticket
        const newTicket: Ticket = {
          id: crypto.randomUUID(),
          title: payload.title,
          description: payload.description || null,
          status: payload.status,
          priority: payload.priority,
          assigneeId: payload.assigneeId || null,
          assignee: null, // Ideally we'd populate this from the mock users list
          createdBy: user,
          labels: [], // Not fully mocking labels mapping yet
          version: 1,
          archivedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        return newTicket
      }

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to create ticket')
      }

      return res.json() as Promise<Ticket>
    },
    onSuccess: (newTicket) => {
      if (import.meta.env.DEV) {
        queryClient.setQueriesData({ queryKey: ['tickets'] }, (oldData: Ticket[] | undefined) => {
          if (!oldData) return [newTicket]
          return [newTicket, ...oldData]
        })
      } else {
        queryClient.invalidateQueries({ queryKey: ['tickets'] })
      }
    },
  })
}
