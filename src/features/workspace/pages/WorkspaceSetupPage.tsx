import { useWorkspaces } from '../hooks/useWorkspaces'
import { WorkspaceSetup } from '../components/WorkspaceSetup'

export function WorkspaceSetupPage() {
  const { data: workspaces, isLoading } = useWorkspaces()

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If user already has a workspace, we need to get the first baby and redirect
  // For now, just show setup if no workspaces
  if (workspaces && workspaces.length > 0) {
    // TODO: Redirect to first workspace/baby
    // For now, show setup again (they can create another workspace)
  }

  return <WorkspaceSetup />
}

