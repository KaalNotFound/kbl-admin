import { useQuery } from '@tanstack/react-query'
import { fetchFinanzas, fetchPatrimonio, fetchFoodSoraStats, fetchFoodSora } from '../api'

export function useFinanzas() {
  return useQuery({
    queryKey: ['finanzas'],
    queryFn: fetchFinanzas,
    staleTime: 60_000,
  })
}

export function usePatrimonio() {
  return useQuery({
    queryKey: ['finanzas', 'patrimonio'],
    queryFn: fetchPatrimonio,
    staleTime: 120_000,
  })
}

export function useFoodSoraStats() {
  return useQuery({
    queryKey: ['finanzas', 'food-sora-stats'],
    queryFn: fetchFoodSoraStats,
    staleTime: 60_000,
  })
}

export function useFoodSora() {
  return useQuery({
    queryKey: ['finanzas', 'food-sora'],
    queryFn: fetchFoodSora,
    staleTime: 60_000,
  })
}
