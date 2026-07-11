const STEPS = [
  {
    n: 1,
    title: 'Profile your risk',
    body: 'Organizations describe their institution type, systems and cryptography in use, and compliance requirements. Infrastructure details stay in an encrypted, NDA-gated workspace.',
  },
  {
    n: 2,
    title: 'Get matched',
    body: 'Search and filter the verified expert directory by specialization, sector experience, and compliance familiarity — no fragmented referral networks or generalist firms.',
  },
  {
    n: 3,
    title: 'Engage securely',
    body: 'Initiate contact, share infrastructure details in a secure environment, and coordinate the assessment end-to-end, from cryptographic audit to full PQC migration roadmap.',
  },
]

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
        <p className="lead" style={{ marginBottom: 32 }}>
          "Harvest now, decrypt later" attacks are already underway. Lattice removes the
          coordination overhead that currently consumes both sides of the quantum-security
          market — organizations stop wasting time on generalist vendors, and experts stop
          wasting time on leads who aren&apos;t ready to act.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {STEPS.map((step) => (
            <div key={step.n} className="card" style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '1.6px solid var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  flex: 'none',
                }}
              >
                {step.n}
              </span>
              <div>
                <h2 className="h2" style={{ marginBottom: 6 }}>
                  {step.title}
                </h2>
                <p className="lead">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
