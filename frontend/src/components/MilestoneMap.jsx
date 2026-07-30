// Connected-path visualization of an engagement's milestones, for list-row
// context (dashboards) where only a status badge showed before -- the detail
// page already lists full milestone info, this is what's missing at a glance.
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString() : null
}

function tip(m) {
  const due = formatDate(m.due_date)
  if (m.status === 'completed') return `${m.title} — completed${formatDate(m.completed_at) ? ` ${formatDate(m.completed_at)}` : ''}`
  if (m.status === 'blocked') return `${m.title} — blocked`
  if (m.status === 'in_progress') return `${m.title} — in progress${due ? ` · due ${due}` : ''}`
  if (m.status === 'skipped') return `${m.title} — skipped`
  return `${m.title}${due ? ` — due ${due}` : ''}`
}

export default function MilestoneMap({ milestones }) {
  if (!milestones || milestones.length === 0) {
    return <p className="mm-empty">No milestones yet.</p>
  }

  const sorted = [...milestones].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const blocked = sorted.find((m) => m.status === 'blocked')
  const current = sorted.find((m) => m.status === 'in_progress')
  const effective = sorted.filter((m) => m.status !== 'skipped')
  const completedCount = effective.filter((m) => m.status === 'completed').length
  const fillCount = completedCount + (current ? 0.5 : 0)
  const fillPct = effective.length > 0 ? Math.min(100, (fillCount / effective.length) * 100) : 0
  const upNext = !blocked && !current ? sorted.find((m) => m.status === 'proposed' || m.status === 'confirmed') : null

  return (
    <div className="mm">
      <div className="mm-track">
        <div className="mm-fill" style={{ width: `${fillPct}%`, background: blocked ? 'var(--danger)' : 'var(--good)' }} />
      </div>
      <div className="mm-nodes">
        {sorted.map((m, i) => (
          <div key={m.milestone_id} className={`mm-node ${m.status === 'completed' ? 'done' : m.status}`} data-tip={tip(m)}>
            {m.status === 'completed' && (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 12.5 9.5 18 20 6" />
              </svg>
            )}
            {m.status === 'in_progress' && <span className="mm-dot" />}
            {m.status === 'blocked' && (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="8" x2="12" y2="13" />
                <line x1="12" y1="16.5" x2="12" y2="16.5" />
              </svg>
            )}
            {m.status === 'skipped' && <span>–</span>}
            {(m.status === 'proposed' || m.status === 'confirmed') && <span>{i + 1}</span>}
          </div>
        ))}
      </div>
      {blocked ? (
        <div className="mm-current-label mm-blocked-label">
          Blocked on: <strong>{blocked.title}</strong>
        </div>
      ) : current ? (
        <div className="mm-current-label">
          Currently on: <strong>{current.title}</strong>
          {formatDate(current.due_date) && <> · due {formatDate(current.due_date)}</>}
        </div>
      ) : completedCount === effective.length && effective.length > 0 ? (
        <div className="mm-current-label">All milestones complete</div>
      ) : upNext ? (
        <div className="mm-current-label">
          Up next: <strong>{upNext.title}</strong>
          {formatDate(upNext.due_date) && <> · due {formatDate(upNext.due_date)}</>}
        </div>
      ) : null}
    </div>
  )
}
