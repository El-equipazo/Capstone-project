import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { engagementsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { useEngagementChat } from '../hooks/useEngagementChat'
import { labelize } from '../utils/format'

export default function EngagementDetail() {
  const user = useRequireAuth()
  const { engagementId } = useParams()

  const [engagement, setEngagement] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    engagementsApi
      .getById(engagementId)
      .then((result) => {
        if (!cancelled) {
          setEngagement(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [user, engagementId])

  // Only open the chat/socket once the participant-gated fetch above has
  // actually succeeded -- don't connect for an engagement the caller turns
  // out not to have access to.
  const { messages, loading: messagesLoading, error: messagesError, sendMessage } = useEngagementChat(
    engagement ? engagementId : null
  )

  if (!user) return null

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <p className="lead">Loading engagement…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="container empty-state">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            {loadError.status === 404 ? 'Engagement not found' : "You don't have access to this engagement"}
          </p>
          <Link to="/" className="btn btn-sm">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  const isMine = (m) => m.sender_id === user.user_id

  async function handleSend(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setSending(true)
    try {
      await sendMessage(draft.trim())
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page">
      <div className="container">
        <span className="section-label">engagement</span>
        <div className="row gap-10 wrap" style={{ margin: '10px 0 18px', justifyContent: 'space-between' }}>
          <h1 className="h2">{engagement.title}</h1>
          <span className="tag">{labelize(engagement.status)}</span>
        </div>

        <div className="chat-panel">
          <div className="chat-messages">
            {messagesLoading && <p className="lead">Loading messages…</p>}
            {messagesError && <div className="alert alert-error">{messagesError}</div>}
            {!messagesLoading && messages.length === 0 && (
              <p className="lead" style={{ fontSize: 12.5 }}>
                No messages yet — say hello.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.message_id} className={`chat-bubble ${isMine(m) ? 'mine' : 'theirs'}`}>
                {m.content}
              </div>
            ))}
          </div>
          <form className="chat-composer" onSubmit={handleSend}>
            <input
              className="field-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
            />
            <button className="btn btn-acc btn-sm" type="submit" disabled={sending || !draft.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
