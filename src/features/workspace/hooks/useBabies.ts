import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWorkspaceBabies, createBaby } from '../api'

export function useBabies(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['babies', workspaceId],
    queryFn: () => getWorkspaceBabies(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useCreateBaby() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, name, dateOfBirth }: { workspaceId: string; name: string; dateOfBirth?: string }) =>
      createBaby(workspaceId, name, dateOfBirth),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['babies', variables.workspaceId] })
    },
  })
}

