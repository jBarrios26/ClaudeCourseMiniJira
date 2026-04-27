import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TicketDraft } from '@/shared/types'

interface DraftState {
  drafts: Record<string, TicketDraft>
  saveDraft: (draft: TicketDraft) => void
  clearDraft: (ticketId: string) => void
  getDraft: (ticketId: string) => TicketDraft | undefined
}

const env = import.meta.env.VITE_ENV ?? 'development'

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      saveDraft: (draft) =>
        set((state) => ({ drafts: { ...state.drafts, [draft.ticketId]: draft } })),
      clearDraft: (ticketId) =>
        set((state) => {
          const { [ticketId]: _, ...rest } = state.drafts
          return { drafts: rest }
        }),
      getDraft: (ticketId) => get().drafts[ticketId],
    }),
    {
      name: `draft:${env}`,
    },
  ),
)
