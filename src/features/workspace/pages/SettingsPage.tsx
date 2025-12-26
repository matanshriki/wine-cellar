import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, UserPlus, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { getWorkspaceMembers } from '../api'
import { getWorkspaceInvites, deleteInvite } from '../api-invites'
import { InviteForm } from '../components/InviteForm'

export function SettingsPage() {
  const { workspaceId, babyId } = useParams<{ workspaceId: string; babyId?: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['workspace-invites', workspaceId],
    queryFn: () => getWorkspaceInvites(workspaceId!),
    enabled: !!workspaceId,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invites', workspaceId] })
      toast({
        title: 'Invite deleted',
        description: 'The invitation has been removed',
      })
    },
  })

  if (!workspaceId) {
    return <div>Invalid workspace</div>
  }

  const backLink = babyId
    ? `/app/workspace/${workspaceId}/baby/${babyId}/timeline`
    : '/app/setup'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={backLink}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Workspace Settings</h1>
      </div>

      {/* Invite New Member */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Invite Caregiver</span>
          </CardTitle>
          <CardDescription>
            Invite family members or caregivers to collaborate on this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm
            workspaceId={workspaceId}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['workspace-invites', workspaceId] })
            }}
          />
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Members</CardTitle>
          <CardDescription>People with access to this workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <p className="text-sm text-muted-foreground">Loading members...</p>
          ) : members && members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{(member as any).user?.email || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No members yet</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>Invitations waiting to be accepted</CardDescription>
        </CardHeader>
        <CardContent>
          {invitesLoading ? (
            <p className="text-sm text-muted-foreground">Loading invites...</p>
          ) : invites && invites.length > 0 ? (
            <div className="space-y-2">
              {invites
                .filter((invite) => invite.status === 'pending')
                .map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Expires: {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(invite.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pending invitations</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

