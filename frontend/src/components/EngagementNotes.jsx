import { useEffect, useRef, useState } from 'react'
import { engagementsApi } from '../api/client'

export default function EngagementNotes({ engagementId }) {
  const [notes, setNotes] = useState('')
  const [notesStatus, setNotesStatus] = useState('') // '' | 'saving' | 'saved'
  const notesLoaded = useRef(false)

  useEffect(() => {
    notesLoaded.current = false
    engagementsApi.getNotes(engagementId)
      .then((res) => { setNotes(res.content || ''); notesLoaded.current = true })
      .catch(() => { notesLoaded.current = true })
  }, [engagementId])

  async function saveNotes() {
    if (!notesLoaded.current) return
    setNotesStatus('saving')
    try {
      await engagementsApi.updateNotes(engagementId, notes)
      setNotesStatus('saved')
      setTimeout(() => setNotesStatus(''), 1500)
    } catch {
      setNotesStatus('')
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="field-label">My Notes</span>
        {notesStatus === 'saving' && <span className="lead" style={{ fontSize: 11 }}>Saving…</span>}
        {notesStatus === 'saved' && <span className="lead" style={{ fontSize: 11 }}>Saved</span>}
      </div>
      <textarea
        className="field-input"
        rows={10}
        style={{ width: '100%' }}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveNotes}
        placeholder="Private notes only you can see…"
      />
    </div>
  )
}
