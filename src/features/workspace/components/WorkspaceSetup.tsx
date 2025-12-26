import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useCreateWorkspace } from '../hooks/useWorkspaces'
import { useCreateBaby } from '../hooks/useBabies'

const setupSchema = z.object({
  workspaceName: z.string().min(1, 'Workspace name is required'),
  babyName: z.string().min(1, 'Baby name is required'),
  dateOfBirth: z.string().optional(),
})

type SetupFormData = z.infer<typeof setupSchema>

export function WorkspaceSetup() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState<'workspace' | 'baby'>('workspace')
  const [workspaceId, setWorkspaceId] = useState<string>()

  const createWorkspace = useCreateWorkspace()
  const createBaby = useCreateBaby()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
  })

  const onSubmit = async (data: SetupFormData) => {
    try {
      if (step === 'workspace') {
        // Create workspace first
        const workspace = await createWorkspace.mutateAsync(data.workspaceName)
        setWorkspaceId((workspace as any).id)
        setStep('baby')
      } else if (workspaceId) {
        // Create baby
        const baby = await createBaby.mutateAsync({
          workspaceId,
          name: data.babyName,
          dateOfBirth: data.dateOfBirth,
        })

        toast({
          title: 'Setup complete!',
          description: 'Your workspace and baby profile have been created.',
        })

        // Navigate to timeline
        navigate(`/app/workspace/${workspaceId}/baby/${baby.id}/timeline`)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to complete setup',
      })
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {step === 'workspace' ? 'Create Your Workspace' : 'Add Your Baby'}
          </CardTitle>
          <CardDescription>
            {step === 'workspace'
              ? 'A workspace is a shared space for your family or caregivers'
              : "Let's add your baby's information"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {step === 'workspace' ? (
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace Name</Label>
                <Input
                  id="workspaceName"
                  placeholder="e.g., Smith Family"
                  {...register('workspaceName')}
                  disabled={createWorkspace.isPending}
                />
                {errors.workspaceName && (
                  <p className="text-sm text-destructive">{errors.workspaceName.message}</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="babyName">Baby's Name</Label>
                  <Input
                    id="babyName"
                    placeholder="e.g., Emma"
                    {...register('babyName')}
                    disabled={createBaby.isPending}
                  />
                  {errors.babyName && (
                    <p className="text-sm text-destructive">{errors.babyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    {...register('dateOfBirth')}
                    disabled={createBaby.isPending}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2">
              {step === 'baby' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('workspace')}
                  disabled={createBaby.isPending}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1"
                disabled={createWorkspace.isPending || createBaby.isPending}
              >
                {step === 'workspace' ? 'Next' : 'Complete Setup'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

