import { Link } from 'react-router-dom'
import LatticeHeroArt from '../components/LatticeHeroArt'
import { useLanguage } from '../context/LanguageContext'

export default function Landing() {
  const { t } = useLanguage()

  const SECTORS = [
    { label: t('landing.sectorBanks'), sub: t('landing.sectorBanksSub') },
    { label: t('landing.sectorPayments'), sub: t('landing.sectorPaymentsSub') },
    { label: t('landing.sectorInvestment'), sub: t('landing.sectorInvestmentSub') },
    { label: t('landing.sectorInsurers'), sub: t('landing.sectorInsurersSub') },
  ]

  const VERIFY_STEPS = [
    { n: 1, title: t('landing.verify1Title'), body: t('landing.verify1Body') },
    { n: 2, title: t('landing.verify2Title'), body: t('landing.verify2Body') },
    { n: 3, title: t('landing.verify3Title'), body: t('landing.verify3Body') },
  ]

  return (
    <>
      <section className="hero-sky">
        <LatticeHeroArt />
        <div className="container">
          <div className="hero-sky-inner">
            <span className="hero-eyebrow">◆ {t('landing.eyebrow')}</span>
            <h1 className="hero-serif">
              {t('landing.heroTitle1')}
              <br />
              {t('landing.heroTitle2')}
            </h1>
            <p className="hero-sub">
              {t('landing.heroSub')}
            </p>
            <Link to="/experts" className="pill-btn">
              {t('landing.browseVerifiedExperts')} <span aria-hidden="true">→</span>
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
                {t('landing.forOrganizations')}
              </span>
              <h2 className="h2" style={{ margin: '10px 0 8px' }}>
                {t('landing.orgHeading')}
              </h2>
              <p className="lead" style={{ marginBottom: 18 }}>
                {t('landing.orgBody')}
              </p>
              <Link to="/experts" className="btn btn-acc btn-block">
                {t('landing.browseVerifiedExperts')}
              </Link>
            </div>
            <div className="card" style={{ padding: 26 }}>
              <span className="section-label">{t('landing.forExperts')}</span>
              <h2 className="h2" style={{ margin: '10px 0 8px' }}>
                {t('landing.expertHeading')}
              </h2>
              <p className="lead" style={{ marginBottom: 18 }}>
                {t('landing.expertBody')}
              </p>
              <Link to="/sign-up?role=expert" className="btn btn-solid btn-block">
                {t('landing.createProfile')}
              </Link>
            </div>
          </div>

          {/* Verification band */}
          <div className="verify-band">
            <div className="verify-head">
              <span className="section-label">{t('landing.howVettingWorks')}</span>
              <h3>{t('landing.vettingHeading')}</h3>
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
          </div>

          {/* Target sectors */}
          <div style={{ marginBottom: 56 }}>
            <span className="section-label">{t('landing.whoThisIsFor')}</span>
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
                {t('landing.readyWhenYouAre')}
              </span>
              <h3>{t('landing.closingHeading')}</h3>
            </div>
            <div className="close-actions">
              <Link to="/sign-up?role=expert" className="btn">
                {t('landing.createProfile')}
              </Link>
              <Link to="/experts" className="btn btn-acc">
                {t('landing.browseVerifiedExperts')} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
