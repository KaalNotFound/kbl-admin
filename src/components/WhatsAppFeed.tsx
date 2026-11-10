import { useState, useEffect, useRef } from 'react'
import { fetchWhatsAppChats, fetchWhatsAppChat } from '../api'
import type { WhatsAppChat, WhatsAppMessage, WhatsAppChatResponse } from '../types'

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-500',
  'bg-orange-500', 'bg-teal-500', 'bg-indigo-500', 'bg-fuchsia-500',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatChatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'ahora'
  if (diff < 86400000) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

function formatMessageTime(ts: string): string {
  // data-pre-plain-text format: [HH:MM, DD/MM/YYYY] Name: message
  const match = ts.match(/\[(\d{2}:\d{2}),\s*(\d{2}\/\d{2}\/\d{4})\]/)
  if (match) return `${match[1]} · ${match[2]}`
  // ISO fallback
  const d = new Date(ts)
  if (!isNaN(d.getTime())) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return ts
}

// --- Loading skeleton ---
function ListSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-surface flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-surface rounded w-1/3" />
            <div className="h-2 bg-surface rounded w-2/3" />
          </div>
          <div className="h-2 bg-surface rounded w-10" />
        </div>
      ))}
    </div>
  )
}

// --- Error WhatsApp ---
function WAErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-6 border-l-4 border-warning">
      <h3 className="text-base font-bold text-warning">WhatsApp no disponible</h3>
      <p className="text-sm text-text-secondary mt-1">
        No se puede conectar a WhatsApp Web. Verificá que:
      </p>
      <ul className="mt-2 text-xs text-text-secondary space-y-1 list-disc list-inside">
        <li>Brave esté abierto con <code className="bg-surface px-1 py-0.5 rounded">--remote-debugging-port=9222</code></li>
        <li>La pestaña de WhatsApp Web esté abierta y logueada</li>
      </ul>
      <details className="mt-3">
        <summary className="text-xs text-text-tertiary cursor-pointer hover:text-text-secondary">
          Error
        </summary>
        <pre className="mt-2 text-xs text-text-tertiary bg-surface p-3 rounded-lg overflow-auto max-h-24 font-mono">
          {message}
        </pre>
      </details>
      <button
        onClick={onRetry}
        className="mt-4 px-4 py-2 text-xs font-medium bg-accent-light text-accent rounded-lg hover:bg-accent/20 transition-colors"
      >
        Reintentar
      </button>
    </div>
  )
}

// --- Chat List Item ---
function ChatRow({ chat, onClick }: { chat: WhatsAppChat; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-150 hover:bg-surface text-left group"
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${getAvatarColor(chat.name)}`}>
        {chat.avatar_letter}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
            {chat.name}
          </p>
          <span className="text-[0.6rem] text-text-tertiary flex-shrink-0">
            {formatChatTime(chat.timestamp)}
          </span>
        </div>
        <p className="text-xs text-text-secondary truncate mt-0.5">
          {chat.last_message || '—'}
        </p>
      </div>

      {/* Unread badge */}
      {chat.unread > 0 && (
        <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[0.6rem] font-bold flex items-center justify-center">
          {chat.unread > 99 ? '99+' : chat.unread}
        </span>
      )}
    </button>
  )
}

// --- Chat Detail View ---
function ChatDetail({
  contact,
  onBack,
}: {
  contact: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchWhatsAppChat(contact)
      .then((data: WhatsAppChatResponse) => setMessages(data.messages || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [contact])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-light bg-card rounded-t-xl">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-text-primary"
          title="Volver"
        >
          ←
        </button>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(contact)}`}>
          {contact.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{contact}</p>
          <p className="text-[0.6rem] text-text-tertiary">
            {messages.length} mensajes
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
        style={{ maxHeight: 'calc(100vh - 380px)' }}
      >
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className={`h-10 ${i % 2 === 0 ? 'w-48' : 'w-36'} bg-surface rounded-2xl`} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-tertiary">Error al cargar mensajes</p>
            <p className="text-xs text-text-tertiary mt-1">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-tertiary">No hay mensajes visibles</p>
            <p className="text-xs text-text-tertiary mt-1">Abrí la conversación en WhatsApp para cargar más</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.outgoing ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.outgoing
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-surface text-text-primary rounded-bl-md'
                }`}
              >
                <p>{msg.text}</p>
                <p className={`text-[0.55rem] mt-1 ${msg.outgoing ? 'text-white/60' : 'text-text-tertiary'}`}>
                  {formatMessageTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// --- Main Component ---
export default function WhatsAppFeed() {
  const [chats, setChats] = useState<WhatsAppChat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    function load() {
      fetchWhatsAppChats()
        .then(setChats)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
    load()

    // Auto-refresh only when on chat list view
    intervalRef.current = setInterval(load, 5000)
    return () => clearInterval(intervalRef.current)
  }, [])

  // Keep selected chat in sync with list
  const selectedChatStillExists = selectedChat && chats.some(c => c.name === selectedChat)

  if (selectedChat && selectedChatStillExists) {
    return <ChatDetail contact={selectedChat} onBack={() => setSelectedChat(null)} />
  }

  // Reset selection if contact no longer exists
  if (selectedChat && !selectedChatStillExists) {
    setSelectedChat(null)
  }

  if (loading) return <ListSkeleton />
  if (error) return <WAErrorMessage message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">{chats.length}</span> contactos con actividad
          <span className="mx-1.5 text-border-light">·</span>
          <span className="text-text-tertiary">auto-refresh 5s</span>
        </p>
      </div>

      {/* Chat list */}
      {chats.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-tertiary">
            No hay conversaciones activas o no leídas
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            Los contactos aparecen aquí cuando envían mensajes nuevos
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-border-light/50">
          {chats.map(chat => (
            <ChatRow
              key={chat.name}
              chat={chat}
              onClick={() => {
                setSelectedChat(chat.name)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
