/**
 * Sommelier Conversation Service
 * 
 * Manages persistence and retrieval of Cellar Sommelier chat conversations
 */

import { supabase } from '../lib/supabase';
import type { AgentMessage } from './agentService';

export interface SommelierConversation {
  id: string;
  user_id: string;
  title: string | null;
  messages: AgentMessage[];
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

/**
 * Get all conversations for the current user
 * Sorted by last_message_at (most recent first)
 */
export async function listConversations(): Promise<SommelierConversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('sommelier_conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    throw new Error('Failed to fetch conversations');
  }

  return (data || []) as SommelierConversation[];
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(id: string): Promise<SommelierConversation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('sommelier_conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching conversation:', error);
    throw new Error('Failed to fetch conversation');
  }

  return data as SommelierConversation;
}

/**
 * Create a new conversation
 */
export async function createConversation(
  messages: AgentMessage[] = [],
  title?: string
): Promise<SommelierConversation> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('sommelier_conversations')
    .insert({
      user_id: user.id,
      messages: messages as any,
      title: title || null,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw new Error('Failed to create conversation');
  }

  return data as SommelierConversation;
}

/**
 * Update an existing conversation
 */
export async function updateConversation(
  id: string,
  messages: AgentMessage[],
  title?: string
): Promise<SommelierConversation> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const updateData: any = {
    messages: messages as any,
    last_message_at: new Date().toISOString(),
  };

  if (title !== undefined) {
    updateData.title = title;
  }

  const { data, error } = await supabase
    .from('sommelier_conversations')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating conversation:', error);
    throw new Error('Failed to update conversation');
  }

  return data as SommelierConversation;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('sommelier_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting conversation:', error);
    throw new Error('Failed to delete conversation');
  }
}

/**
 * Generate a title for a conversation based on its first message
 * Returns a short, descriptive title (max 50 chars)
 */
export function generateConversationTitle(messages: AgentMessage[]): string {
  if (messages.length === 0) {
    return 'New conversation';
  }

  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) {
    return 'New conversation';
  }

  const content = firstUserMessage.content.trim();
  
  // Truncate to 50 chars
  if (content.length <= 50) {
    return content;
  }

  return content.substring(0, 47) + '...';
}

