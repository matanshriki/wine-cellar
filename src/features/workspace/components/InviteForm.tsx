import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { createInvite } from '../api-invites'

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteFormProps {
  workspaceId: string
  onSuccess: () => void
}

export function InviteForm({ workspaceId, onSuccess }: InviteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  })

  const onSubmit = async (data: InviteFormData) => {
    setIsSubmitting(true)
    try {
      await createInvite(workspaceId, data.email)
      toast({
        title: 'Invite sent',
        description: `An invitation has been sent to ${data.email}`,
      })
      reset()
      onSuccess()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invite',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="caregiver@example.com"
          {...register('email')}
          disabled={isSubmitting}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Invitation'}
      </Button>
    </form>
  )
}

