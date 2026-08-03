import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

const ICONS = {
  shieldCheck: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7.5 3v5.2c0 4.5-3.1 8.2-7.5 9.6-4.4-1.4-7.5-5.1-7.5-9.6V6z" />
      <path d="M9.2 12.1l2 2 3.6-3.9" />
    </svg>
  ),
  link: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M10 7h4a3 3 0 0 1 3 3v4" />
      <path d="M7 10v4a3 3 0 0 0 3 3h4" />
    </svg>
  ),
  messageCircle: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.4 7.2L4 20.5l1.3-4.2A8 8 0 1 1 21 12z" />
    </svg>
  ),
}

export default function Landing() {
  const { t } = useLanguage()

  const howCards = [
    { variant: 'cobalt', icon: ICONS.shieldCheck, title: t('landing.how1Title'), body: t('landing.how1Body') },
    { variant: 'forest', icon: ICONS.link, title: t('landing.how2Title'), body: t('landing.how2Body') },
    { variant: 'coral', icon: ICONS.messageCircle, title: t('landing.how3Title'), body: t('landing.how3Body') },
  ]

  const trustCols = [
    { title: t('landing.trustIdentity'), body: t('landing.trustIdentityBody') },
    { title: t('landing.trustCredentials'), body: t('landing.trustCredentialsBody') },
    { title: t('landing.trustOrg'), body: t('landing.trustOrgBody') },
    { title: t('landing.trustBackground'), body: t('landing.trustBackgroundBody') },
  ]

  const footerLinks = [
    { label: t('landing.footerHow'), href: '#how' },
    { label: t('landing.footerDirectory'), href: '#directory' },
    { label: t('landing.footerForExperts'), href: '#experts' },
    { label: t('landing.footerVerification'), href: '#trust' },
  ]

  return (
    <div className="lp-page">
      <div className="lp-grain" aria-hidden="true" />

      <section className="lp-hero">
        <img className="lp-hero-media" src="/landing/hero.jpg" alt="" />
        <div className="lp-hero-scrim" />
        <div className="lp-hero-copy">
          <span className="lp-eyebrow lp-rise-1">{t('landing.heroEyebrow')}</span>
          <h1 className="lp-h1 lp-rise-2">{t('landing.heroTitle')}</h1>
          <p className="lp-subhead lp-rise-3">{t('landing.heroSub')}</p>
          <div className="lp-hero-actions lp-rise-4">
            <Link to="/experts" className="lp-btn-primary">
              {t('landing.browseDirectory')}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/sign-up?role=expert" className="lp-btn-secondary">
              {t('landing.applyAsExpert')}
            </Link>
          </div>
        </div>
      </section>

      <div className="lp-segments">
        <span>{t('landing.segmentBanks')}</span>
        <span>{t('landing.segmentPayments')}</span>
        <span>{t('landing.segmentInvestment')}</span>
        <span>{t('landing.segmentInsurers')}</span>
      </div>

      <section id="how" className="lp-how">
        <div className="lp-wrap">
          <span className="lp-section-tag">{t('landing.howTag')}</span>
          <h2>{t('landing.howHeading')}</h2>
          <p className="lp-how-intro">{t('landing.howIntro')}</p>
          <div className="lp-how-grid">
            {howCards.map((card) => (
              <div key={card.title} className={`lp-how-card lp-how-card--${card.variant}`}>
                <span className="lp-how-icon">{card.icon}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="directory" className="lp-band">
        <img className="lp-band-media" src="/landing/band.jpg" alt="" />
        <div className="lp-band-scrim" />
        <div className="lp-band-copy">
          <div className="lp-band-copy-inner">
            <span className="lp-band-eyebrow">{t('landing.bandEyebrow')}</span>
            <p className="lp-band-statement">{t('landing.bandStatement')}</p>
            <p className="lp-band-body">{t('landing.bandBody')}</p>
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
                <h4>{col.title}</h4>
                <p>{col.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-grid">
          <div className="lp-cta-card lp-cta-card--cobalt">
            <span className="lp-cta-eyebrow">{t('landing.ctaOrgEyebrow')}</span>
            <h3>{t('landing.ctaOrgHeading')}</h3>
            <p>{t('landing.ctaOrgBody')}</p>
            <Link to="/sign-up?role=organization" className="lp-cta-btn lp-cta-btn--coral">
              {t('landing.ctaOrgBtn')}
            </Link>
          </div>
          <div id="experts" className="lp-cta-card lp-cta-card--forest">
            <span className="lp-cta-eyebrow">{t('landing.ctaExpertEyebrow')}</span>
            <h3>{t('landing.ctaExpertHeading')}</h3>
            <p>{t('landing.ctaExpertBody')}</p>
            <Link to="/sign-up?role=expert" className="lp-cta-btn lp-cta-btn--cream">
              {t('landing.ctaExpertBtn')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link to="/" className="lp-footer-brand">
            <span className="lp-footer-brand-mark">L</span>
            <span className="lp-footer-brand-name">Lattice</span>
          </Link>
          <div className="lp-footer-links">
            {footerLinks.map((link) => (
              <a key={link.label} href={link.href}>{link.label}</a>
            ))}
          </div>
          <span className="lp-footer-legal">{t('landing.footerLegal')}</span>
        </div>
      </footer>
    </div>
  )
}
