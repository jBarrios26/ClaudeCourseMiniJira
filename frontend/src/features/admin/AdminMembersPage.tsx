import { useState } from 'react'
import { useMembers, useDeleteMember, useInviteMember } from './useMembers'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, UserPlus, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole, User } from '@/shared/types'

function InviteMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { mutate: inviteMember, isPending } = useInviteMember()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('user')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    inviteMember({ name, email, role }, {
      onSuccess: () => {
        onOpenChange(false)
        setName('')
        setEmail('')
        setRole('user')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite new member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input required value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" disabled={isPending} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" disabled={isPending} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={role} onValueChange={(val) => setRole(val as UserRole)} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>{isPending ? 'Inviting...' : 'Send Invitation'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({ member }: { member: User }) {
  const { mutate: deleteMember, isPending } = useDeleteMember()

  return (
    <tr className="border-b border-outline/10 last:border-0 hover:bg-surface_container transition-colors">
      <td className="px-4 py-3 font-medium text-inverse_surface">
        <div className="flex items-center gap-2">
          {member.role === 'admin' ? <ShieldAlert size={14} className="text-primary" /> : null}
          {member.name}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
      <td className="px-4 py-3">
        <span className={cn(
          "px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wide",
          member.role === 'admin' ? "bg-primary/10 text-primary" : "bg-outline/10 text-inverse_surface/70"
        )}>
          {member.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          "px-2 py-1 rounded-md text-xs font-medium",
          member.removedAt ? "bg-error/10 text-error" : "bg-success/10 text-success"
        )}>
          {member.removedAt ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {!member.removedAt && (
          <button
            onClick={() => deleteMember(member.id)}
            disabled={isPending}
            className="p-1.5 text-inverse_surface/50 hover:text-error hover:bg-error/10 rounded-md transition-colors disabled:opacity-50"
            title="Remove Member"
          >
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  )
}

export function AdminMembersPage() {
  const { data: members, isLoading } = useMembers()
  const [isInviteOpen, setIsInviteOpen] = useState(false)

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-inverse_surface">Team Members</h1>
          <p className="text-muted-foreground">Manage your team structure and permissions.</p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
          <UserPlus size={16} />
          Invite Member
        </Button>
      </div>

      <div className="bg-surface_container_lowest rounded-lg border border-outline/20 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface_container_low text-inverse_surface/60 border-b border-outline/20">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">Loading members...</td></tr>
            ) : members?.map(member => (
              <MemberRow key={member.id} member={member} />
            ))}
            {!isLoading && members?.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <InviteMemberDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
    </div>
  )
}
