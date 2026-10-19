import { useQuery } from '@tanstack/react-query'
import { fetchWhatsAppChats, fetchWhatsAppChat } from '../api'

export function useWhatsAppChats() {
  return useQuery({
    queryKey: ['whatsapp', 'chats'],
    queryFn: fetchWhatsAppChats,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}

export function useWhatsAppChat(name: string | null) {
  return useQuery({
    queryKey: ['whatsapp', 'chat', name],
    queryFn: () => fetchWhatsAppChat(name!),
    enabled: !!name,
    staleTime: 10_000,
  })
}
