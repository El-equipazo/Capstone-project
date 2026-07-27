import { useCallback, useEffect, useRef, useState } from 'react'
import { threadsApi } from '../api/client'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000

export function useThreadChat(threadId) {
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
    if (!threadId) return
    let cancelled = false
    setLoading(true)
    threadsApi
      .messages(threadId)
      .then((page) => {
        if (cancelled) return
        const ordered = [...page.data].reverse()
        ordered.forEach((m) => seenIds.current.add(m.message_id))
        setMessages(ordered)
        setLoading(false)
        threadsApi.markRead(threadId).catch(() => {})
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.body?.error?.message ?? 'Could not load messages.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [threadId])

  useEffect(() => {
    if (!threadId) return
    unmounting.current = false

    function connect() {
      const socket = new WebSocket(threadsApi.wsUrl(threadId))
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
  }, [threadId, upsert])

  const sendMessage = useCallback(
    async (content) => {
      const created = await threadsApi.send(threadId, content)
      upsert(created)
      return created
    },
    [threadId, upsert]
  )

  return { messages, loading, error, sendMessage }
}
