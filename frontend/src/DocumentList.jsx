import { useEffect, useState } from 'react'
import { api } from './api.js'

export function fmtDate(iso, lang) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(lang === 'ky' ? 'ky-KG' : 'ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function StatusPill({ t, status }) {
  return <span className={'status st-' + status}>{t('status_' + status)}</span>
}

export default function DocumentList({ t, lang, section, onOpen, reloadKey }) {
  const [docs, setDocs] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setDocs(null)
    setError(false)
    api('/documents/?section=' + encodeURIComponent(section))
      .then(setDocs)
      .catch(() => setError(true))
  }, [section, reloadKey])

  if (error) return <p className="alert">{t('loadError')}</p>
  if (!docs) return <p className="empty">{t('loading')}</p>
  if (!docs.length) return <p className="empty">{t('empty')}</p>

  return (
    <div className="card table-card">
      <table className="doc-table">
        <thead>
          <tr>
            <th>{t('colNumber')}</th>
            <th>{t('subject')}</th>
            <th>{t('colKind')}</th>
            <th>{t('colAuthor')}</th>
            <th>{t('colDate')}</th>
            <th>{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} onClick={() => onOpen(d.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(d.id)}>
              <td className="nowrap">{d.number || <span className="muted">{t('noNumber')}</span>}</td>
              <td className="strong">{d.subject}</td>
              <td className="muted">{d.kind}</td>
              <td className="nowrap">{d.created_by?.full_name}</td>
              <td className="nowrap muted">{fmtDate(d.created_at, lang)}</td>
              <td><StatusPill t={t} status={d.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
