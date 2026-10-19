import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchInventory, createInventoryItem } from '../api'

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: fetchInventory,
    staleTime: 30_000,
  })
}

export function useCreateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}
