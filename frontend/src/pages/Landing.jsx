import { Link } from 'react-router-dom'
import LatticeHeroArt from '../components/LatticeHeroArt'

const SECTORS = [
  { label: 'Banks', sub: 'Retail, commercial & community banks' },
  { label: 'Payment processors', sub: 'Card networks, payment rails, fintech infrastructure' },
  { label: 'Investment firms', sub: 'Asset managers, hedge funds, broker-dealers' },
  { label: 'Insurers', sub: 'Carriers holding decades of policyholder data' },
]

const VERIFY_STEPS = [
  { n: 1, title: 'Credentials submitted', body: 'Institution, certification, or license — with supporting documents, not a self-reported checkbox.' },
  { n: 2, title: 'AI-assisted review', body: 'Every document is screened for inconsistencies and red flags before a human ever looks at it.' },
  { n: 3, title: 'Verified, not assumed', body: 'An admin makes the final call. Only then does the verified badge appear on a public profile.' },
]

export default function Landing() {
  return (
    <>
      <section className="hero-sky">
        <LatticeHeroArt />
        <div className="container">
          <div className="hero-sky-inner">
            <span className="hero-eyebrow">◆ post-quantum readiness, before the quantum cliff arrives</span>
            <h1 className="hero-serif">
              Quantum risk has two sides.
              <br />
              Pick yours.
            </h1>
            <p className="hero-sub">
              Lattice is a verified marketplace connecting high-risk financial institutions with
              the quantum security experts who can assess and remediate their cryptographic
              exposure — before a quantum breakthrough renders today&apos;s protections obsolete.
            </p>
            <Link to="/experts" className="pill-btn">
              Browse verified experts <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="page" style={{ paddingTop: 0 }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div className="card" style={{ padding: 26, background: 'var(--fill2)' }}>
              <span className="section-label" style={{ color: 'var(--acc)' }}>
                for organizations
              </span>
              <h2 className="h2" style={{ margin: '10px 0 8px' }}>
                Assess &amp; remediate your quantum exposure
              </h2>
              <p className="lead" style={{ marginBottom: 18 }}>
                Search a curated directory of verified quantum security professionals, filtered by
                specialization, engagement type, and compliance familiarity — then engage
                end-to-end in a secure workspace.
              </p>
              <Link to="/experts" className="btn btn-acc btn-block">
                Browse verified experts
              </Link>
            </div>
            <div className="card" style={{ padding: 26 }}>
              <span className="section-label">for experts</span>
              <h2 className="h2" style={{ margin: '10px 0 8px' }}>
                Get discovered by institutions that need you
              </h2>
              <p className="lead" style={{ marginBottom: 18 }}>
                Build a structured profile — credentials, specializations, sector experience,
                engagement types — and stop spending your time on leads who aren&apos;t ready to
                act.
              </p>
              <Link to="/sign-up?role=expert" className="btn btn-solid btn-block">
                Create your profile
              </Link>
            </div>
          </div>

          {/* Verification band */}
          <div className="verify-band">
            <div className="verify-head">
              <span className="section-label">how vetting works</span>
              <h3>Every expert on Lattice is verified before you ever see their profile.</h3>
            </div>
            <div className="verify-steps">
              {VERIFY_STEPS.map((step) => (
                <div className="verify-step" key={step.n}>
                  <span className="n">{step.n}</span>
                  <div>
                    <div className="t">{step.title}</div>
                    <div className="d">{step.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="verify-connector" />
            <div className="verify-foot">
              <span className="dot" /> This is the actual review pipeline — not marketing copy.
            </div>
          </div>

          {/* Target sectors */}
          <div style={{ marginBottom: 56 }}>
            <span className="section-label">who this is for</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 14,
                marginTop: 14,
              }}
            >
              {SECTORS.map((s) => (
                <div key={s.label} className="card" style={{ padding: 18 }}>
                  <div className="sector-mark" />
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{s.label}</div>
                  <div className="lead" style={{ fontSize: 12 }}>
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Closing CTA */}
          <div className="close-band">
            <div>
              <span className="section-label" style={{ color: 'var(--acc)' }}>
                ready when you are
              </span>
              <h3>Find your quantum security partner — or your next engagement.</h3>
            </div>
            <div className="close-actions">
              <Link to="/sign-up?role=expert" className="btn">
                Create your profile
              </Link>
              <Link to="/experts" className="btn btn-acc">
                Browse verified experts →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
