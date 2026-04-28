import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Ticket, UpdateTicketPayload } from '@/shared/types'

export function useUpdateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateTicketPayload) => {
      if (import.meta.env.DEV) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500))
        return { id, ...payload } // Mock response
      }

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to update ticket')
      }

      return res.json()
    },
    onMutate: async () => {
      // Typically you'd cancel outgoing queries and snapshot the old state here
      // Below is a simple optimistic update that mutates ALL 'tickets' queries regardless of active filters.
    },
    onSuccess: (_, { id, ...payload }) => {
      // In DEV we aggressively modify the cache since the MOCK DB remains unchanged
      if (import.meta.env.DEV) {
        queryClient.setQueriesData({ queryKey: ['tickets'] }, (oldData: Ticket[] | undefined) => {
          if (!oldData) return oldData
          return oldData.map((t) => 
            t.id === id 
              ? { ...t, ...payload, version: t.version + 1 }
              : t
          )
        })
      } else {
        queryClient.invalidateQueries({ queryKey: ['tickets'] })
      }
    },
  })
}
