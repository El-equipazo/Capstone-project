import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi, messagesApi, threadsApi } from '../api/client'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000

function buildUrls(type, id) {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
  const wsBase = base.replace(/^http/, 'ws')
  const token = authApi.getSession()?.access_token ?? ''
  if (type === 'thread') {
    return {
      rest: () => threadsApi.messages(id),
      send: (content) => threadsApi.send(id, content),
      markRead: () => threadsApi.markRead(id),
      ws: `${wsBase}/threads/${id}/ws?token=${encodeURIComponent(token)}`,
    }
  }
  return {
    rest: () => messagesApi.list(id),
    send: (content) => messagesApi.send(id, { message_type: 'text', content }),
    markRead: () => messagesApi.markRead(id, { all: true }),
    ws: `${wsBase}/engagements/${id}/ws?token=${encodeURIComponent(token)}`,
  }
}

export function useChat(type, id) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
    if (!type || !id) return
    let cancelled = false
    seenIds.current = new Set()
    setMessages([])
    setLoading(true)
    setError('')
    const urls = buildUrls(type, id)
    urls
      .rest()
      .then((page) => {
        if (cancelled) return
        const ordered = [...page.data].reverse()
        ordered.forEach((m) => seenIds.current.add(m.message_id))
        setMessages(ordered)
        setLoading(false)
        urls.markRead().catch(() => {})
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.body?.error?.message ?? 'Could not load messages.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [type, id])

  useEffect(() => {
    if (!type || !id) return
    unmounting.current = false
    const urls = buildUrls(type, id)

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
  }, [type, id, upsert])

  const sendMessage = useCallback(
    async (content) => {
      const urls = buildUrls(type, id)
      const created = await urls.send(content)
      upsert(created)
      return created
    },
    [type, id, upsert]
  )

  return { messages, loading, error, sendMessage }
}
