import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserWorkspaces, createWorkspace } from '../api'

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: getUserWorkspaces,
  })
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

