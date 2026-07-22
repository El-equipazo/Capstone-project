import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { expertsApi } from '../api/client'
import ExpertCard from '../components/ExpertCard'
import LatticeHeroArt from '../components/LatticeHeroArt'

const SECTORS = [
  { icon: '🏦', label: 'Banks', sub: 'Retail, commercial & community banks' },
  { icon: '💳', label: 'Payment processors', sub: 'Card networks, payment rails, fintech infrastructure' },
  { icon: '📈', label: 'Investment firms', sub: 'Asset managers, hedge funds, broker-dealers' },
  { icon: '🛡️', label: 'Insurers', sub: 'Carriers holding decades of policyholder data' },
]

export default function Landing() {
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    expertsApi.list().then((res) => setFeatured(res.data.slice(0, 3)))
  }, [])

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

          {/* Trust band */}
          <div
            className="card"
            style={{ background: 'var(--ink)', borderColor: 'var(--ink)', padding: '20px 24px', marginBottom: 56 }}
          >
            <span className="section-label" style={{ color: '#c8d6e4' }}>
              how experts are vetted
            </span>
            <div className="row gap-10 wrap" style={{ marginTop: 12 }}>
              <span className="chip" style={{ background: 'transparent', borderColor: '#565049', color: '#e6e3dc' }}>
                ✓ Credentials verified
              </span>
              <span className="chip" style={{ background: 'transparent', borderColor: '#565049', color: '#e6e3dc' }}>
                ✓ Certifications checked
              </span>
              <span className="chip" style={{ background: 'transparent', borderColor: '#565049', color: '#e6e3dc' }}>
                ✓ Sector-compliance proven
              </span>
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
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{s.label}</div>
                  <div className="lead" style={{ fontSize: 12 }}>
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Featured experts */}
          <div>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <span className="section-label">featured experts</span>
              <Link to="/experts" className="tag">
                see full directory →
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {featured.map((expert) => (
                <ExpertCard key={expert.expert_profile_id} expert={expert} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
