// whatsapp.ts — dominio WhatsApp (ADR-026)
import { fetchJSON } from './client'
import type { WhatsAppChat, WhatsAppChatResponse } from '../types'

export function fetchWhatsAppChats(): Promise<WhatsAppChat[]> {
  return fetchJSON<WhatsAppChat[]>(`/api/whatsapp/chats`)
}

export function fetchWhatsAppChat(name: string): Promise<WhatsAppChatResponse> {
  return fetchJSON<WhatsAppChatResponse>(`/api/whatsapp/chat/${encodeURIComponent(name)}`)
}
