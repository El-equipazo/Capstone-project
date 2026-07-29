import { Link } from 'react-router-dom'

const ORG_STEPS = [
  {
    n: 1,
    title: 'Profile your risk',
    body: 'Describe your institution type, systems and cryptography in use, and compliance requirements. Infrastructure details stay in an encrypted, NDA-gated workspace.',
  },
  {
    n: 2,
    title: 'Get matched',
    body: 'Search and filter the verified expert directory by specialization, engagement type, and compliance familiarity — no fragmented referral networks or generalist firms.',
  },
  {
    n: 3,
    title: 'Engage securely',
    body: 'Initiate contact, share infrastructure details in a secure environment, and coordinate the assessment end-to-end, from cryptographic audit to full PQC migration roadmap.',
  },
]

const EXPERT_STEPS = [
  {
    n: 1,
    title: 'Build your profile',
    body: 'Structure what you offer — credentials, specializations, sector experience, and engagement types — so institutions can find you by what you actually do.',
  },
  {
    n: 2,
    title: 'Submit for verification',
    body: 'Upload your credentials with supporting documents. Every submission is AI-screened for inconsistencies, then an admin makes the final call before your verified badge goes live.',
  },
  {
    n: 3,
    title: 'Get discovered',
    body: "Verified profiles surface in the directory institutions actually search. Respond to inbound interest instead of chasing leads who aren't ready to act.",
  },
]

function Flow({ steps }) {
  return (
    <div className="flow">
      <div className="flow-line" />
      {steps.map((step) => (
        <div className="flow-step" key={step.n}>
          <span className="n">{step.n}</span>
          <div className="content">
            <div className="t">{step.title}</div>
            <div className="d">{step.body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HowItWorks() {
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <span className="section-label" style={{ color: 'var(--acc)' }}>
          how it works
        </span>
        <h1 className="h1" style={{ margin: '12px 0 14px' }}>
          From cryptographic exposure to a remediation plan you can act on.
        </h1>
        <p className="lead" style={{ marginBottom: 48 }}>
          "Harvest now, decrypt later" attacks are already underway. Lattice removes the
          coordination overhead that currently consumes both sides of the quantum-security
          market — organizations stop wasting time on generalist vendors, and experts stop
          wasting time on leads who aren&apos;t ready to act.
        </p>

        <div style={{ marginBottom: 28 }}>
          <span className="section-label" style={{ color: 'var(--acc)' }}>
            for organizations
          </span>
        </div>
        <Flow steps={ORG_STEPS} />

        <div style={{ margin: '48px 0 28px' }}>
          <span className="section-label">for experts</span>
        </div>
        <Flow steps={EXPERT_STEPS} />

        <div className="close-band" style={{ marginTop: 56 }}>
          <div>
            <span className="section-label" style={{ color: 'var(--acc)' }}>
              ready when you are
            </span>
            <h3>See who&apos;s already verified, or start your own profile.</h3>
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
  )
}
