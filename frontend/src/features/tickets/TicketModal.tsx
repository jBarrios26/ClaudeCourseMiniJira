import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TicketForm } from './TicketForm'
import { useCreateTicket } from './useCreateTicket'
import type { TicketFormValues } from './ticketSchema'
import type { User } from '@/shared/types'

interface TicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: User[]
}

export function TicketModal({ open, onOpenChange, members }: TicketModalProps) {
  const { mutate: createTicket, isPending } = useCreateTicket()

  const handleSubmit = (data: TicketFormValues) => {
    createTicket(data, {
      onSuccess: () => {
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Ticket</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <TicketForm
            members={members}
            onSubmit={handleSubmit}
            isSubmitting={isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
