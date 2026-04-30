import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectState {
  activeProjectId: number | null
  setActiveProject: (id: number | null) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProject: (id) => set({ activeProjectId: id }),
    }),
    { name: 'active-project' },
  )
)
