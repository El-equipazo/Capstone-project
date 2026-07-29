import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi, threadsApi } from '../api/client'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000

function buildUrls(id) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const wsBase = base.startsWith('/')
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${base}`
    : base.replace(/^http/, 'ws')
  const token = authApi.getSession()?.access_token ?? ''
  return {
    rest: () => threadsApi.messages(id),
    send: (content) => threadsApi.send(id, content),
    markRead: () => threadsApi.markRead(id),
    ws: `${wsBase}/threads/${id}/ws?token=${encodeURIComponent(token)}`,
  }
}

export function useChat(id, currentUserId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // The first message that was unread at the moment this conversation was
  // opened -- computed once, synchronously alongside the fetch response that
  // actually belongs to `id`, so there's no window where a separate effect
  // could read a stale (previous-conversation) `messages` array while `id`
  // has already moved on to the next conversation.
  const [firstUnreadId, setFirstUnreadId] = useState(null)
  const seenIds = useRef(new Set())
  const socketRef = useRef(null)
  const reconnectAttempt = useRef(0)
  const reconnectTimer = useRef(null)
  const unmounting = useRef(false)

  const upsert = useCallback((msg) => {
    if (seenIds.current.has(msg.message_id)) return
    seenIds.current.add(msg.message_id)
    setMessages((prev) => [...prev, msg])
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    seenIds.current = new Set()
    setMessages([])
    setFirstUnreadId(null)
    setLoading(true)
    setError('')
    const urls = buildUrls(id)
    urls
      .rest()
      .then((page) => {
        if (cancelled) return
        const ordered = [...page.data].reverse()
        ordered.forEach((m) => seenIds.current.add(m.message_id))
        setMessages(ordered)
        const firstUnread = ordered.find((m) => !m.is_read && m.sender_id !== currentUserId)
        setFirstUnreadId(firstUnread ? firstUnread.message_id : null)
        setLoading(false)
        urls.markRead().then(() => {
          window.dispatchEvent(new Event('notifications:refresh'))
        }).catch(() => {})
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.body?.error?.message ?? 'Could not load messages.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, currentUserId])

  useEffect(() => {
    if (!id) return
    unmounting.current = false
    const urls = buildUrls(id)

    function connect() {
      const socket = new WebSocket(urls.ws)
      socketRef.current = socket
      socket.onopen = () => { reconnectAttempt.current = 0 }
      socket.onmessage = (event) => {
        try { upsert(JSON.parse(event.data)) } catch { /* ignore malformed frame */ }
      }
      socket.onclose = (event) => {
        if (unmounting.current) return
        if (event.code >= 4001 && event.code <= 4004) return
        const attempt = reconnectAttempt.current + 1
        reconnectAttempt.current = attempt
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS)
        reconnectTimer.current = setTimeout(connect, delay)
      }
      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      unmounting.current = true
      clearTimeout(reconnectTimer.current)
      socketRef.current?.close()
    }
  }, [id, upsert])

  const sendMessage = useCallback(
    async (content) => {
      const urls = buildUrls(id)
      const created = await urls.send(content)
      upsert(created)
      return created
    },
    [id, upsert]
  )

  return { messages, loading, error, sendMessage, firstUnreadId }
}
