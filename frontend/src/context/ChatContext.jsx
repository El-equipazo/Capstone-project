import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { threadsApi } from '../api/client'
import { useAuth } from './AuthContext'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const { user } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [active, setActive] = useState(null) // { type, id, title }
  const [conversations, setConversations] = useState([])

  const loadConversations = useCallback(async () => {
    if (!user) return
    try {
      const threads = await threadsApi.list()

      const convs = threads.map((t) => ({
        id: t.thread_id,
        title: user.role === 'organization'
          ? `${t.expert_first_name} ${t.expert_last_name}`
          : (t.org_name || 'Organization'),
        unread_count: t.unread_count ?? 0,
        last_activity: t.last_message_at || t.created_at,
      })).sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity))

      setConversations(convs)
    } catch {
      // non-fatal — window still renders, sidebar just empty
    }
  }, [user])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const openChat = useCallback((id, title) => {
    setActive({ id, title })
    setIsOpen(true)
    setIsMinimized(false)
    // refresh list so unread counts are current
    loadConversations()
  }, [loadConversations])

  const minimize = useCallback(() => setIsMinimized(true), [])
  const maximize = useCallback(() => { setIsOpen(true); setIsMinimized(false) }, [])
  const closeChat = useCallback(() => {
    setIsOpen(false)
    setIsMinimized(false)
  }, [])

  const markActiveRead = useCallback(() => {
    if (!active) return
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id ? { ...c, unread_count: 0 } : c
      )
    )
  }, [active])

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  return (
    <ChatContext.Provider value={{
      isOpen, isMinimized, active, conversations, totalUnread,
      openChat, minimize, maximize, closeChat, markActiveRead, loadConversations,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat_context() {
  return useContext(ChatContext)
}
