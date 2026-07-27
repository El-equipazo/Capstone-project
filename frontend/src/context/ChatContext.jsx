import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { engagementsApi, threadsApi } from '../api/client'
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
      const [engs, threads] = await Promise.all([
        engagementsApi.list(),
        threadsApi.list(),
      ])

      const engConvs = engs.map((e) => ({
        type: 'engagement',
        id: e.engagement_id,
        title: e.title || (e.org_name ?? e.expert_first_name
          ? (e.org_name || `${e.expert_first_name} ${e.expert_last_name}`)
          : 'Engagement'),
        subtitle: e.org_name || `${e.expert_first_name} ${e.expert_last_name}`,
        unread_count: e.unread_count ?? 0,
        last_activity: e.updated_at,
      }))

      const threadConvs = threads.map((t) => ({
        type: 'thread',
        id: t.thread_id,
        title: user.role === 'organization'
          ? `${t.expert_first_name} ${t.expert_last_name}`
          : (t.org_name || 'Organization'),
        subtitle: user.role === 'organization' ? 'Inquiry' : 'Inquiry',
        unread_count: t.unread_count ?? 0,
        last_activity: t.last_message_at || t.created_at,
      }))

      const all = [...engConvs, ...threadConvs].sort(
        (a, b) => new Date(b.last_activity) - new Date(a.last_activity)
      )
      setConversations(all)
    } catch {
      // non-fatal — window still renders, sidebar just empty
    }
  }, [user])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const openChat = useCallback((type, id, title) => {
    setActive({ type, id, title })
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
    setActive(null)
  }, [])

  const markActiveRead = useCallback(() => {
    if (!active) return
    setConversations((prev) =>
      prev.map((c) =>
        c.type === active.type && c.id === active.id ? { ...c, unread_count: 0 } : c
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
