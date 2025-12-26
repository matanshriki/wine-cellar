import { supabase } from '@/lib/supabase'
import { Workspace, Baby, WorkspaceMember } from '@/types/models'

export async function getUserWorkspaces() {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace:workspaces(*)')
    .order('joined_at', { ascending: false })

  if (error) throw error
  return (data as any[]).map((item: any) => item.workspace) as Workspace[]
}

export async function createWorkspace(name: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Create workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name, created_by: user.id } as any)
    .select()
    .single()

  if (workspaceError) throw workspaceError

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: (workspace as any).id, user_id: user.id, role: 'owner' } as any)

  if (memberError) throw memberError

  return workspace as Workspace
}

export async function getWorkspaceBabies(workspaceId: string) {
  const { data, error } = await supabase
    .from('babies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Baby[]
}

export async function createBaby(workspaceId: string, name: string, dateOfBirth?: string) {
  const { data, error } = await supabase
    .from('babies')
    .insert({
      workspace_id: workspaceId,
      name,
      date_of_birth: dateOfBirth || null,
    } as any)
    .select()
    .single()

  if (error) throw error
  return data as Baby
}

export async function getWorkspaceMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, user:auth.users(email)')
    .eq('workspace_id', workspaceId)

  if (error) throw error
  return data as WorkspaceMember[]
}

