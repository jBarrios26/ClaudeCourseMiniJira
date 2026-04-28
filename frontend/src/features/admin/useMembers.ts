import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { User } from '@/shared/types'
import { MOCK_MEMBERS } from '@/features/board/useBoardTickets'

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        return [...MOCK_MEMBERS]
      }
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members`)
      if (!res.ok) throw new Error('Failed to fetch members')
      return res.json() as Promise<User[]>
    },
    // Populate cache with mock in DEV if needed, but the queryFn returns it anyway
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { name: string; email: string; role: 'user' | 'admin' }) => {
      if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const newUser: User = {
          id: crypto.randomUUID(),
          ...payload,
          removedAt: null,
        }
        return newUser
      }
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to invite member')
      return res.json() as Promise<User>
    },
    onSuccess: (newUser) => {
      queryClient.setQueryData(['members'], (old: User[] = []) => {
        return [...old, newUser]
      })
    },
  })
}

export function useDeleteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return { success: true }
      }
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove member')
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(['members'], (old: User[] = []) => {
        // Technically marking as removed, but for UI we might just filter them out depending on requirements.
        // The mock requirement says: remove them from the array.
        return old.filter(u => u.id !== deletedId)
      })
    },
  })
}
