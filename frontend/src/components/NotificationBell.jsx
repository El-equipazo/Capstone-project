import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { notificationsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useChat_context } from '../context/ChatContext'

// First interval-polling precedent in this codebase (everything else is
// on-demand fetch or the chat websocket) -- notifications aren't
// engagement-scoped like chat messages are, so they don't get a socket of
// their own in this pass. 25s is cheap enough for a capstone backend and
// tight enough to feel live.
const POLL_MS = 25000

export default function NotificationBell() {
  const { user } = useAuth()
  const { openChat, conversations } = useChat_context()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onOutsideClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [open])

  useEffect(() => {
    if (!user) {
      setCount(0)
      return
    }
    let cancelled = false
    function poll() {
      notificationsApi
        .unreadCount()
        .then(({ count: c }) => {
          if (!cancelled) setCount(c)
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    window.addEventListener('notifications:refresh', poll)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('notifications:refresh', poll)
    }
  }, [user])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      setItemsLoading(true)
      notificationsApi
        .list({ isRead: false })
        .then(setItems)
        .finally(() => setItemsLoading(false))
    }
  }

  async function markAllRead() {
    await notificationsApi.markAllRead()
    setItems([])
    setCount(0)
  }

  function handleRowClick(notificationId) {
    notificationsApi.markRead(notificationId).catch(() => {})
    setItems((prev) => prev.filter((n) => n.notification_id !== notificationId))
    setCount((prev) => Math.max(0, prev - 1))
    setOpen(false)
  }

  if (!user) return null

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button className="notif-bell" onClick={toggle} aria-label="Notifications">
        🔔{count > 0 && <span className="notif-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notif-dropdown card">
          <div className="row gap-8" style={{ justifyContent: 'space-between', padding: '10px 14px' }}>
            <span className="section-label">Notifications</span>
            {items.length > 0 && (
              <button className="btn btn-sm" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {itemsLoading && (
            <p className="lead" style={{ padding: '0 14px 14px', fontSize: 12.5 }}>
              Loading…
            </p>
          )}
          {!itemsLoading && items.length === 0 && (
            <p className="lead" style={{ padding: '0 14px 14px', fontSize: 12.5 }}>
              You're all caught up.
            </p>
          )}
          {items.map((n) => {
            const content = (
              <>
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                {n.body && <div style={{ marginTop: 2, color: 'var(--muted)' }}>{n.body}</div>}
              </>
            )

            const threadIdStr = n.action_url
              ? new URLSearchParams(n.action_url.split('?')[1] ?? '').get('open_thread')
              : null

            if (threadIdStr) {
              const threadId = parseInt(threadIdStr, 10)
              const title = conversations.find((c) => c.id === threadId)?.title ?? 'Chat'
              return (
                <button
                  key={n.notification_id}
                  className="notif-row"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => { handleRowClick(n.notification_id); openChat(threadId, title) }}
                >
                  {content}
                </button>
              )
            }

            return n.action_url ? (
              <Link
                key={n.notification_id}
                to={n.action_url}
                className="notif-row"
                onClick={() => handleRowClick(n.notification_id)}
              >
                {content}
              </Link>
            ) : (
              <div
                key={n.notification_id}
                className="notif-row"
                onClick={() => handleRowClick(n.notification_id)}
              >
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
