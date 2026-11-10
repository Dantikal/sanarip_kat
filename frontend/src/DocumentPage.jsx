import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { fmtDate, StatusPill } from './DocumentList.jsx'
import FileViewer from './FileViewer.jsx'
import { UserChip } from './UserPicker.jsx'
import ResolutionPanel from './ResolutionPanel.jsx'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const s16 = { ...s, strokeWidth: 1.6 }

const TABS = [
  { id: 'view', title: 'tabView', icon: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" {...s16} /><circle cx="12" cy="12" r="3" {...s16} /></> },
  { id: 'info', title: 'docInfo', icon: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s16} /><path d="M14 3v5h5M9 13h6M9 17h6" {...s16} /></> },
  { id: 'sign', title: 'signature', icon: <><path d="M14 3H7a2 2 0 0 0-2 2v6" {...s16} /><path d="M14 3l5 5v11a2 2 0 0 1-2 2h-6M14 3v5h5" {...s16} /><circle cx="7" cy="16" r="3" {...s16} /><path d="M5.5 18.5L5 22l2-1 2 1-.5-3.5" {...s16} /></> },
]

const ORDER = { official: 0, appendix: 1, internal: 2 }

export default function DocumentPage({ t, lang, id, section, onBack, onOpen, onChanged }) {
  const [doc, setDoc] = useState(null)
  const [tab, setTab] = useState('view')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const [clamped, setClamped] = useState(false)
  const [copied, setCopied] = useState(false)
  const [siblings, setSiblings] = useState(null)
  const contentRef = useRef(null)

  useEffect(() => {
    api(`/documents/${id}/`)
      .then((d) => { setDoc(d); onChanged?.() })
      .catch(() => setError(t('loadError')))
  }, [id])

  useEffect(() => {
    if (!section) return
    api('/documents/?section=' + encodeURIComponent(section.id)).then(setSiblings).catch(() => setSiblings(null))
  }, [section?.id, doc?.status])

  useEffect(() => {
    const el = contentRef.current
    if (el) setClamped(el.scrollHeight > el.clientHeight + 2)
  }, [doc?.content])

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      setDoc(await fn())
      onChanged?.()
    } catch (ex) {
      setError(ex.data?.code ? t(ex.data.code) : t('loadError'))
    } finally {
      setBusy(false)
    }
  }

  const sign = () => run(() => api(`/documents/${id}/sign/`, { method: 'POST' }))
  const close = () => run(() => api(`/documents/${id}/close/`, { method: 'POST' }))
  const archive = () => run(() => api(`/documents/${id}/archive/`, { method: 'POST' }))
  const toggleFavorite = () =>
    run(async () => ({ ...doc, ...(await api(`/documents/${id}/favorite/`, { method: 'POST' })) }))

  const copyLink = async () => {
    const link = `${location.origin}${location.pathname}#/doc/${id}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = link
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const backBtn = (
    <button className="back" onClick={onBack}>
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 6l-6 6 6 6" {...s} /></svg>
      {t('back')}
    </button>
  )

  const nav = section && siblings && (() => {
    const i = siblings.findIndex((x) => x.id === id)
    const next = i >= 0 ? siblings[i + 1] || null : siblings[0] || null
    return (
      <div className="card sec-bar">
        <div className="sec-bar-side">{backBtn}</div>
        <div className="sec-bar-mid">
          <div className="sec-bar-title">{section.title}</div>
          <div className="sec-bar-count">{t('docsCount')}: {siblings.length}</div>
        </div>
        <div className="sec-bar-side right">
          {next && next.id !== id && (
            <button className="sec-next" onClick={() => onOpen(next.id)} title={t('nextDoc')}>
              <span>
                <span className="sec-next-num">{next.number ? '№' + next.number : t('noNumber')}</span>
                <span className="sec-next-kind">{next.kind}</span>
              </span>
              <svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12h14M13 6l6 6-6 6" {...s} /></svg>
            </button>
          )}
        </div>
      </div>
    )
  })()

  if (!doc) {
    return (
      <div className="doc-page">
        {backBtn}
        <p className={error ? 'alert' : 'empty'}>{error || t('loading')}</p>
      </div>
    )
  }

  const signed = ['signed', 'closed', 'archived'].includes(doc.status)
  const waiting = doc.status === 'on_signing'
  const awaitingKey = signed ? 'notAwaited'
    : waiting ? 'awaitingSigner'
    : doc.status === 'pending' ? 'awaitingRegistration'
    : doc.status === 'rework' ? 'awaitingRework'
    : doc.status === 'rejected' ? 'notAwaited'
    : 'awaitingResolution'
  const attachments = [...doc.attachments].sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
  const dateOnly = new Date(doc.created_at).toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU')

  return (
    <div className="doc-page">
      {nav || <div className="doc-top">{backBtn}</div>}

      <div className="doc-split">
      <article className="card doc-card">
        <div className="doc-toolbar">
          <div className="doc-toolbar-left">
            <button className={'tb-btn' + (doc.is_favorite ? ' on' : '')} disabled={busy} onClick={toggleFavorite}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" {...s16} fill={doc.is_favorite ? 'currentColor' : 'none'} />
              </svg>
              {doc.is_favorite ? t('inFavorites') : t('toFavorites')}
            </button>
          </div>
          <button className="tb-btn" onClick={copyLink}>
            <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="18" cy="5" r="3" {...s16} /><circle cx="6" cy="12" r="3" {...s16} /><circle cx="18" cy="19" r="3" {...s16} /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" {...s16} /></svg>
            {copied ? t('linkCopied') : t('copyLink')}
          </button>
        </div>

        <div className="doc-pills">
          <span className="pill big">{t('noPaper')}</span>
          <StatusPill t={t} status={doc.status} />
          {doc.on_control && <span className="pill grey">{t('onControl')}</span>}
          {doc.urgency !== 'normal' && <span className="pill warn">{t('urg_' + doc.urgency)}</span>}
        </div>

        <h1 className="doc-title">
          {doc.kind} {doc.number ? '№' + doc.number : t('noNumber')} <span className="doc-date">{t('fromDate')} {dateOnly}</span>
        </h1>
        <div className="doc-subj">{doc.subject}</div>
        <div ref={contentRef} className={'doc-content' + (more ? ' open' : '')}>{doc.content}</div>
        {(clamped || more) && (
          <button className="pill read-more" onClick={() => setMore(!more)}>
            {more ? t('collapse') : t('readMore')}
          </button>
        )}

        <div className="doc-icon-tabs" role="tablist">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              className={tab === x.id ? 'active' : ''}
              title={t(x.title)}
              onClick={() => setTab(x.id)}
            >
              <svg viewBox="0 0 24 24" width="22" height="22">{x.icon}</svg>
            </button>
          ))}
        </div>

        {error && <div className="alert">{error}</div>}

        <div className="doc-tab-body">
          {tab === 'view' && <FileViewer t={t} attachments={attachments} />}

          {tab === 'info' && (
            <dl className="info">
              <dt>{t('colNumber')}</dt><dd>{doc.number || t('noNumber')}</dd>
              <dt>{t('colKind')}</dt><dd>{doc.kind}</dd>
              <dt>{t('subject')}</dt><dd>{doc.subject}</dd>
              <dt>{t('content')}</dt><dd className="pre">{doc.content}</dd>
              {doc.tags && <><dt>{t('tags')}</dt><dd>{doc.tags}</dd></>}
              <dt>{t('docView')}</dt><dd>{t('view_' + doc.view)}</dd>
              <dt>{t('docLanguage')}</dt><dd>{doc.languages.map((l) => t('lang_' + l)).join(', ')}</dd>
              <dt>{t('urgency')}</dt><dd>{t('urg_' + doc.urgency)}</dd>
              <dt>{t('recipients')}</dt>
              <dd>{doc.recipients.map((r, i) => <div key={i}>{r.name} <span className="muted">· {t('rec_' + r.type)}</span></div>)}</dd>
              <dt>{t('colAuthor')}</dt><dd>{doc.created_by.full_name} <span className="muted">· {doc.created_by.department}</span></dd>
              <dt>{t('colDate')}</dt><dd>{fmtDate(doc.created_at, lang)}</dd>
              <dt>{t('files')}</dt>
              <dd>
                {attachments.map((a) => (
                  <a key={a.id} className="file-row link" href={a.url + '?download=1'} download>
                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...s} /></svg>
                    <span className="file-name">{a.name}</span>
                    <span className="muted small">{t('file_' + a.kind)}</span>
                  </a>
                ))}
              </dd>
            </dl>
          )}

          {tab === 'sign' && (
            <div className="sign-tab">
              <dl className="info one">
                <dt>{t('status')}</dt>
                <dd><StatusPill t={t} status={doc.status} /></dd>
                <dt>{t('awaiting')}</dt>
                <dd className={signed ? 'ok' : waiting ? 'warn' : ''}>
                  {t(awaitingKey)}
                </dd>
              </dl>
              <div className="sign-box">
                <div className="sign-label">{t('signerSignature')}: {doc.signer?.full_name || '—'}</div>
                {signed ? (
                  <div className="sign-ok">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12l5 5 9-10" {...s} /></svg>
                    <div>
                      <div className="strong">{t('status_signed')}</div>
                      <div className="muted small">{doc.signed_by?.full_name} · {fmtDate(doc.signed_at, lang)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="muted">{waiting ? t('notSignedYet') : '—'}</div>
                )}
              </div>

              <h3 className="sub-title">{t('chooseApprovers')}</h3>
              <ol className="steps">
                {doc.approvers.map((a, i) => (
                  <li key={a.id} className="step">
                    <span className="step-num">{i + 1}</span>
                    <UserChip user={a} badge={i === 0 ? t('forSignature') : null} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </article>

      <aside className="doc-res">
        <ResolutionPanel
          t={t}
          lang={lang}
          doc={doc}
          busy={busy}
          onSign={sign}
          onClose={close}
          onArchive={archive}
          onChange={(d) => { setDoc(d); onChanged?.() }}
        />
      </aside>
      </div>
    </div>
  )
}
