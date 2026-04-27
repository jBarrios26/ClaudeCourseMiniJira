import { useNavigate } from 'react-router-dom'
import { useDraftStore } from '@/shared/stores/draftStore'

export function DraftBanner() {
  const navigate = useNavigate()
  const drafts = useDraftStore((s) => s.drafts)
  const clearDraft = useDraftStore((s) => s.clearDraft)

  const pendingDrafts = Object.values(drafts)
  if (pendingDrafts.length === 0) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-4 text-sm text-yellow-800">
      {pendingDrafts.map((draft) => (
        <span key={draft.ticketId} className="flex items-center gap-2">
          You have an unsaved draft for ticket #{draft.ticketId.slice(0, 8)}.{' '}
          <button
            className="underline font-medium"
            onClick={() => navigate(`/tickets/${draft.ticketId}`)}
          >
            Resume editing?
          </button>
          <button
            className="text-yellow-600 hover:text-yellow-800 ml-1"
            onClick={() => clearDraft(draft.ticketId)}
            aria-label="Discard draft"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}
