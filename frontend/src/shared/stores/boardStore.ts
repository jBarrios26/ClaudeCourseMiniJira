import { create } from 'zustand'

interface BoardState {
  activeTicketId: string | null
  pendingMoveId:  string | null
  setActiveTicket: (id: string | null) => void
  setPendingMove:  (id: string | null) => void
}

export const useBoardStore = create<BoardState>((set) => ({
  activeTicketId: null,
  pendingMoveId:  null,
  setActiveTicket: (id) => set({ activeTicketId: id }),
  setPendingMove:  (id) => set({ pendingMoveId: id }),
}))
