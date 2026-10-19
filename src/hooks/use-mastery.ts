import { useQuery } from '@tanstack/react-query'
import { fetchMasteryAll, fetchSkillTree, fetchCognitiveDebt, fetchBiasData } from '../api'

export function useMasteryAll() {
  return useQuery({
    queryKey: ['mastery', 'all'],
    queryFn: fetchMasteryAll,
    staleTime: 30_000,
  })
}

export function useSkillTree() {
  return useQuery({
    queryKey: ['mastery', 'skill-tree'],
    queryFn: fetchSkillTree,
    staleTime: 30_000,
  })
}

export function useCognitiveDebt() {
  return useQuery({
    queryKey: ['mastery', 'debt'],
    queryFn: fetchCognitiveDebt,
    staleTime: 60_000,
  })
}

export function useBiasData() {
  return useQuery({
    queryKey: ['mastery', 'bias'],
    queryFn: fetchBiasData,
    staleTime: 60_000,
  })
}
