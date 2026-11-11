import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WhatsAppFeed from '../components/WhatsAppFeed'

import type { WhatsAppChat, WhatsAppChatResponse } from '../types'

// Mock at the api barrel boundary (ADR-026): the list fetch resolves once and
// the detail fetch is never called (no chat is selected). The component's 5s
// auto-refresh interval re-invokes the mocked list fetch, which is harmless.
vi.mock('../api', () => ({
  fetchWhatsAppChats: vi.fn(async (): Promise<WhatsAppChat[]> => [
    {
      name: 'Mamá',
      last_message: 'Hola',
      timestamp: '2026-11-10T09:00:00Z',
      unread: 2,
      avatar_letter: 'M',
    },
  ]),
  fetchWhatsAppChat: vi.fn(async (): Promise<WhatsAppChatResponse> => ({
    messages: [],
    contact: '',
  })),
}))

describe('WhatsAppFeed mount', () => {
  it('renders the chat list header without crashing', async () => {
    render(<WhatsAppFeed />)
    // The count is interpolated into a sibling span: match the stable text.
    expect(await screen.findByText(/contactos con actividad/)).toBeTruthy()
    expect(screen.getByText('auto-refresh 5s')).toBeTruthy()
  })
})
