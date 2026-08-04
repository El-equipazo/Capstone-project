import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import LatticeField from '../components/LatticeField'
import LatticeMark from '../components/LatticeMark'

const TRUST_ICONS = {
  identity: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7.5 3v5.2c0 4.5-3.1 8.2-7.5 9.6-4.4-1.4-7.5-5.1-7.5-9.6V6z" />
      <path d="M9.2 12.1l2 2 3.6-3.9" />
    </svg>
  ),
  credentials: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="9" r="4.2" />
      <path d="M8.5 12.3L6.5 20l5.5-3 5.5 3-2-7.7" />
    </svg>
  ),
  org: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="10" width="16" height="10" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  background: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 21c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5" />
    </svg>
  ),
}

export default function Landing() {
  const { t } = useLanguage()

  const flowSteps = [
    { num: '01 — REQUEST', title: t('landing.how1Title'), body: t('landing.how1Body') },
    { num: '02 — MATCH', title: t('landing.how2Title'), body: t('landing.how2Body') },
    { num: '03 — VERIFY', title: t('landing.how3Title'), body: t('landing.how3Body') },
  ]

  const timelinePoints = [
    {
      variant: 'signal',
      label: t('landing.threatTodayLabel'),
      value: t('landing.threatTodayValue'),
      body: t('landing.threatTodayBody'),
    },
    {
      variant: 'amber',
      label: t('landing.threatExposureLabel'),
      value: t('landing.threatExposureValue'),
      body: t('landing.threatExposureBody'),
    },
    {
      variant: '',
      label: t('landing.threatQdayLabel'),
      value: t('landing.threatQdayValue'),
      body: t('landing.threatQdayBody'),
    },
  ]

  const trustCols = [
    { icon: TRUST_ICONS.identity, title: t('landing.trustIdentity'), body: t('landing.trustIdentityBody') },
    { icon: TRUST_ICONS.credentials, title: t('landing.trustCredentials'), body: t('landing.trustCredentialsBody') },
    { icon: TRUST_ICONS.org, title: t('landing.trustOrg'), body: t('landing.trustOrgBody') },
    { icon: TRUST_ICONS.background, title: t('landing.trustBackground'), body: t('landing.trustBackgroundBody') },
  ]

  // Directory isn't an in-page section like the other three -- it's the
  // actual expert directory route, same destination as the hero's "Browse
  // the directory" button -- so it navigates instead of anchor-scrolling.
  const footerLinks = [
    { label: t('landing.footerHow'), href: '#how' },
    { label: t('landing.footerDirectory'), to: '/experts' },
    { label: t('landing.footerForExperts'), href: '#experts' },
    { label: t('landing.footerVerification'), href: '#trust' },
  ]

  return (
    <div className="lp-page">
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow lp-rise-1">{t('landing.heroEyebrow')}</span>
            <h1 className="lp-h1 lp-rise-2">{t('landing.heroTitle')}</h1>
            <p className="lp-subhead lp-rise-3">{t('landing.heroSub')}</p>
            <div className="lp-hero-actions lp-rise-4">
              <Link to="/experts" className="lp-btn-primary">
                {t('landing.browseDirectory')}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h13" /><path d="M12 5l7 7-7 7" /></svg>
              </Link>
              <Link to="/sign-up?role=expert" className="lp-btn-secondary">
                {t('landing.applyAsExpert')}
              </Link>
            </div>
          </div>
          <div className="lp-hero-stage">
            <LatticeField />
          </div>
        </div>
      </section>

      <div className="lp-segments">
        <span>{t('landing.segmentBanks')}</span>
        <span>{t('landing.segmentPayments')}</span>
        <span>{t('landing.segmentInvestment')}</span>
        <span>{t('landing.segmentInsurers')}</span>
      </div>

      <section className="lp-threat">
        <div className="lp-wrap">
          <div className="lp-threat-head">
            <span className="lp-eyebrow">{t('landing.threatTag')}</span>
            <h2>{t('landing.threatHeading')}</h2>
            <p className="lp-threat-intro">{t('landing.threatIntro')}</p>
          </div>
          <div className="lp-timeline">
            <div className="lp-timeline-track">
              <div className="lp-timeline-risk" />
            </div>
            <div className="lp-timeline-points">
              {timelinePoints.map((p) => (
                <div key={p.label} className={`lp-tpoint ${p.variant ? `lp-tpoint--${p.variant}` : ''}`}>
                  <span className="lp-tpoint-label">{p.label}</span>
                  <div className="lp-tpoint-value">{p.value}</div>
                  <p className="lp-tpoint-body">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="lp-how">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <div>
              <span className="lp-section-tag">{t('landing.howTag')}</span>
              <h2>{t('landing.howHeading')}</h2>
            </div>
            <p className="lp-how-intro">{t('landing.howIntro')}</p>
          </div>
          <div className="lp-flow">
            {flowSteps.map((step) => (
              <div key={step.num} className="lp-flow-step">
                <span className="lp-flow-node" />
                <span className="lp-flow-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="lp-trust">
        <div className="lp-wrap">
          <span className="lp-section-tag">{t('landing.trustTag')}</span>
          <h2>{t('landing.trustHeading')}</h2>
          <div className="lp-trust-grid">
            {trustCols.map((col) => (
              <div key={col.title} className="lp-trust-col">
                {col.icon}
                <h4>{col.title}</h4>
                <p>{col.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-grid">
          <div className="lp-cta-card lp-cta-card--org">
            <span className="lp-cta-eyebrow">{t('landing.ctaOrgEyebrow')}</span>
            <h3>{t('landing.ctaOrgHeading')}</h3>
            <p>{t('landing.ctaOrgBody')}</p>
            <Link to="/sign-up?role=organization" className="lp-cta-btn">
              {t('landing.ctaOrgBtn')} →
            </Link>
          </div>
          <div id="experts" className="lp-cta-card lp-cta-card--expert">
            <span className="lp-cta-eyebrow">{t('landing.ctaExpertEyebrow')}</span>
            <h3>{t('landing.ctaExpertHeading')}</h3>
            <p>{t('landing.ctaExpertBody')}</p>
            <Link to="/sign-up?role=expert" className="lp-cta-btn">
              {t('landing.ctaExpertBtn')} →
            </Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link to="/" className="lp-footer-brand">
            <span className="lp-footer-brand-mark"><LatticeMark /></span>
            <span className="lp-footer-brand-name">LATTICE</span>
          </Link>
          <div className="lp-footer-links">
            {footerLinks.map((link) =>
              link.to ? (
                <Link key={link.label} to={link.to}>{link.label}</Link>
              ) : (
                <a key={link.label} href={link.href}>{link.label}</a>
              )
            )}
          </div>
          <span className="lp-footer-legal">{t('landing.footerLegal')}</span>
        </div>
      </footer>
    </div>
  )
}
