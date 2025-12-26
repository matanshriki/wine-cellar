import { supabase } from '@/lib/supabase'
import { Invite } from '@/types/models'

export async function createInvite(workspaceId: string, email: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Set expiration to 7 days from now
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data, error } = await supabase
    .from('invites')
    .insert({
      workspace_id: workspaceId,
      email,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    } as any)
    .select()
    .single()

  if (error) throw error
  return data as Invite
}

export async function getWorkspaceInvites(workspaceId: string) {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Invite[]
}

export async function getUserInvites() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('invites')
    .select('*, workspace:workspaces(name)')
    .eq('email', user.email)
    .eq('status', 'pending')

  if (error) throw error
  return data as (Invite & { workspace: { name: string } })[]
}

export async function acceptInvite(inviteId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get invite details
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .single()

  if (inviteError) throw inviteError
  if (!invite) throw new Error('Invite not found')
  
  const inviteData = invite as any

  // Check if expired
  if (new Date(inviteData.expires_at) < new Date()) {
    throw new Error('Invite has expired')
  }

  // Add user to workspace
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: inviteData.workspace_id,
      user_id: user.id,
      role: 'member',
    } as any)

  if (memberError) throw memberError

  // Update invite status
  const { error: updateError } = await supabase
    .from('invites')
    .update({ status: 'accepted' } as never)
    .eq('id', inviteId)

  if (updateError) throw updateError
}

export async function deleteInvite(inviteId: string) {
  const { error } = await supabase.from('invites').delete().eq('id', inviteId)

  if (error) throw error
}

