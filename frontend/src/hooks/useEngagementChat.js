import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi, messagesApi } from '../api/client'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000

function wsUrlFor(engagementId) {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
  const wsBase = base.replace(/^http/, 'ws') // http -> ws, https -> wss
  const token = authApi.getSession()?.access_token ?? ''
  return `${wsBase}/engagements/${engagementId}/ws?token=${encodeURIComponent(token)}`
}

// REST is the only write path (messagesApi.send); the websocket is a pure
// receive-only broadcast of messages the server already persisted. Every
// insertion -- the REST response for the sender's own send, and every WS
// frame -- goes through the same upsert() keyed on message_id, so a
// duplicate delivery (e.g. a second open tab) is a no-op instead of a bug.
export function useEngagementChat(engagementId) {
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
    if (!engagementId) return
    let cancelled = false
    setLoading(true)
    messagesApi
      .list(engagementId)
      .then((page) => {
        if (cancelled) return
        const ordered = [...page.data].reverse() // API is newest-first; render oldest -> newest
        ordered.forEach((m) => seenIds.current.add(m.message_id))
        setMessages(ordered)
        setLoading(false)
        messagesApi.markRead(engagementId, { all: true }).catch(() => {})
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.body?.error?.message ?? 'Could not load messages.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [engagementId])

  useEffect(() => {
    if (!engagementId) return
    unmounting.current = false

    function connect() {
      const socket = new WebSocket(wsUrlFor(engagementId))
      socketRef.current = socket
      socket.onopen = () => {
        reconnectAttempt.current = 0
      }
      socket.onmessage = (event) => {
        try {
          upsert(JSON.parse(event.data))
        } catch {
          // ignore malformed frame
        }
      }
      socket.onclose = () => {
        if (unmounting.current) return
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
  }, [engagementId, upsert])

  const sendMessage = useCallback(
    async (content, opts = {}) => {
      const created = await messagesApi.send(engagementId, {
        message_type: opts.messageType ?? 'text',
        content,
        document_id: opts.documentId,
      })
      upsert(created) // don't wait for the WS echo -- the REST response is authoritative
      return created
    },
    [engagementId, upsert]
  )

  return { messages, loading, error, sendMessage }
}
