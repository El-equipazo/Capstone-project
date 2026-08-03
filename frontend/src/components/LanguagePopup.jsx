import { useLanguage } from '../context/LanguageContext'
import { LANGUAGE_OPTIONS } from '../i18n/translations'

export default function LanguagePopup({ onClose }) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 400, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div>
          <h2 className="h2" style={{ fontSize: 18, marginBottom: 4 }}>{t('languagePopup.title')}</h2>
          <p className="lead" style={{ fontSize: 12.5 }}>{t('languagePopup.subtitle')}</p>
        </div>

        <div className="field-group">
          <label className="field-label">{t('languagePopup.label')}</label>
          <select
            className="field-input"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>{opt.name}</option>
            ))}
          </select>
        </div>

        <button type="button" className="btn btn-acc" style={{ alignSelf: 'flex-end' }} onClick={onClose}>
          {t('languagePopup.done')}
        </button>
      </div>
    </div>
  )
}
