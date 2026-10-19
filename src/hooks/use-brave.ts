import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchBraveTabs, activateBraveTab } from '../api'

export function useBraveTabs() {
  return useQuery({
    queryKey: ['brave', 'tabs'],
    queryFn: fetchBraveTabs,
    refetchInterval: 15_000,
    staleTime: 5000,
  })
}

export function useActivateBraveTab() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateBraveTab,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brave', 'tabs'] }),
  })
}
