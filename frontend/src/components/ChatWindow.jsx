import { useEffect, useRef, useState } from 'react'
import { useChat_context } from '../context/ChatContext'
import { useChat } from '../hooks/useChat'
import { useAuth } from '../context/AuthContext'

function ConversationPane({ active, onSent }) {
  const { user } = useAuth()
  const { messages, loading, error, sendMessage } = useChat(active?.id)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  // The "New" divider marks the first message that was unread at the moment
  // this conversation was opened -- computed once from the initial fetch
  // response (before useChat's markRead() call flips the server-side flag),
  // and reset whenever the active conversation changes.
  const [firstUnreadId, setFirstUnreadId] = useState(null)
  const computedForId = useRef(null)

  useEffect(() => {
    if (computedForId.current === active?.id) return
    if (messages.length === 0) return
    computedForId.current = active?.id
    const firstUnread = messages.find((m) => !m.is_read && m.sender_id !== user?.user_id)
    setFirstUnreadId(firstUnread ? firstUnread.message_id : null)
  }, [messages, active?.id, user?.user_id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setSending(true)
    try {
      await sendMessage(draft.trim())
      setDraft('')
      onSent?.()
    } finally {
      setSending(false)
    }
  }

  if (!active) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
      <span className="lead" style={{ fontSize: 13 }}>Select a conversation</span>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--brd)', fontWeight: 600, fontSize: 13 }}>
        {active.title}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
        {loading && <p className="lead" style={{ fontSize: 12 }}>Loading…</p>}
        {error && <p style={{ color: 'var(--err, red)', fontSize: 12 }}>{error}</p>}
        {!loading && messages.length === 0 && (
          <p className="lead" style={{ fontSize: 12, opacity: 0.6 }}>No messages yet.</p>
        )}
        {messages.flatMap((m) => {
          const els = []
          if (m.message_id === firstUnreadId) {
            els.push(
              <div
                key={`divider-${m.message_id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', alignSelf: 'stretch' }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc)' }}>New</span>
                <div style={{ flex: 1, borderTop: '2px solid var(--acc)' }} />
              </div>
            )
          }
          els.push(
            <div
              key={m.message_id}
              style={{
                alignSelf: m.sender_id === user?.user_id ? 'flex-end' : 'flex-start',
                background: m.sender_id === user?.user_id ? 'var(--acc)' : 'var(--srf)',
                color: m.sender_id === user?.user_id ? '#fff' : 'inherit',
                borderRadius: 8, padding: '6px 10px',
                maxWidth: '75%', fontSize: 13,
              }}
            >
              {m.content}
            </div>
          )
          return els
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--brd)' }}>
        <input
          className="field-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1 }}
        />
        <button className="btn btn-sm" type="submit" disabled={sending || !draft.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default function ChatWindow() {
  const { isOpen, isMinimized, active, conversations, totalUnread, openChat, minimize, maximize, markActiveRead, loadConversations } = useChat_context()
  const { user } = useAuth()
  const prevUnread = useRef(0)
  const [highlighted, setHighlighted] = useState(false)

  useEffect(() => {
    if (totalUnread > prevUnread.current && (!isOpen || isMinimized)) {
      setHighlighted(true)
      const t = setTimeout(() => setHighlighted(false), 2000)
      return () => clearTimeout(t)
    }
    prevUnread.current = totalUnread
  }, [totalUnread, isOpen, isMinimized])

  const windowRef = useRef(null)

  useEffect(() => {
    if (!isOpen || isMinimized) return
    function onOutsideClick(event) {
      if (windowRef.current && !windowRef.current.contains(event.target)) {
        minimize()
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [isOpen, isMinimized, minimize])

  if (!user) return null

  const activeConv = conversations.find((c) => c.id === active?.id)
  const previewText = activeConv?.last_message_preview
    ? activeConv.last_message_preview.split(' ').slice(0, 4).join(' ')
    : null

  // Show full window when open and not minimized; otherwise always render the
  // minimized bar — this gives every logged-in user (including experts) a
  // persistent entry point to their conversations.
  if (isOpen && !isMinimized) {
    // fall through to full-window render below
  } else {
    return (
      <>
        <style>{`
          @keyframes chat-pulse {
            0%   { box-shadow: 0 -4px 18px rgba(0,0,0,0.18); border-color: var(--acc); }
            40%  { box-shadow: 0 -6px 28px rgba(var(--acc-rgb, 99,102,241), 0.6); border-color: var(--acc); }
            100% { box-shadow: 0 -4px 18px rgba(0,0,0,0.18); border-color: var(--acc); }
          }
        `}</style>
        <div
          onClick={isMinimized ? maximize : () => { loadConversations(); maximize() }}
          style={{
            position: 'fixed', bottom: 0, right: 24,
            minWidth: 280,
            background: 'var(--bg)',
            border: `2px solid var(--acc)`,
            borderBottom: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '10px 18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 -4px 18px rgba(0,0,0,0.18)',
            zIndex: 1000,
            animation: highlighted ? 'chat-pulse 0.6s ease-in-out 3' : 'none',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Messages{active?.title ? ` — ${active.title}` : ''}
            </div>
            {previewText && (
              <div style={{
                fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden',
                maskImage: 'linear-gradient(to right, black 75%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black 75%, transparent 100%)',
              }}>
                {previewText}
              </div>
            )}
          </div>
          {totalUnread > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', background: 'var(--acc)', color: '#fff', borderRadius: 99 }}>
              {totalUnread}
            </span>
          )}
          <span style={{ fontSize: 16, opacity: 0.4, lineHeight: 1 }}>↑</span>
        </div>
      </>
    )
  }

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed', bottom: 0, right: 24,
        width: 700, height: 480,
        background: 'var(--bg)', border: '1px solid var(--brd)',
        borderBottom: 'none', borderRadius: '8px 8px 0 0',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--brd)' }}>
        <span className="section-label">Messages</span>
        <button onClick={minimize} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.5 }}>—</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 200, borderRight: '1px solid var(--brd)', overflowY: 'auto', flexShrink: 0 }}>
          {conversations.length === 0 && (
            <p className="lead" style={{ fontSize: 12, padding: 14, opacity: 0.6 }}>No conversations.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openChat(c.id, c.title)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none',
                borderBottom: '1px solid rgba(128,128,128,0.3)',
                borderLeft: c.unread_count > 0 ? '3px solid var(--acc)' : '3px solid transparent',
                background: active?.id === c.id ? 'var(--srf)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontWeight: c.unread_count > 0 ? 700 : 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {c.title}
                </span>
              </div>
              <span style={{ fontSize: 11, opacity: 0.5 }}>Chat</span>
            </button>
          ))}
        </div>

        {/* Conversation pane */}
        <ConversationPane
          active={active}
          onSent={() => { markActiveRead(); loadConversations() }}
        />
      </div>
    </div>
  )
}
