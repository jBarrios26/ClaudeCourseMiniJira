import { z } from 'zod'

export const ticketSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es requerido')
    .max(120, 'Title must be 120 characters or fewer'),
  description: z.string().optional(),
  status: z.enum(['to_do', 'in_progress', 'in_review', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  assigneeId: z.string().uuid().nullable().optional(),
  labelIds: z.array(z.number()).optional(),
})

export type TicketFormValues = z.infer<typeof ticketSchema>
