import { useState } from 'react'
import { api } from './api.js'
import { fmtDate } from './DocumentList.jsx'
import UserPicker, { initials, UserChip } from './UserPicker.jsx'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

const PrintIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" {...s} /><path d="M7 14h10v7H7z" {...s} /></svg>
)

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function printHtml(title, html) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const d = frame.contentDocument
  d.open()
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>body{font-family:Roboto,Arial,sans-serif;color:#111;margin:32px}h1{font-size:20px;margin:0 0 4px}
    .muted{color:#555;font-size:13px}table{border-collapse:collapse;margin-top:16px;width:100%}
    td{padding:6px 8px;border:1px solid #ccc;font-size:14px;vertical-align:top}td:first-child{width:180px;color:#555}
    .text{margin:16px 0;font-size:16px;white-space:pre-wrap}h2{font-size:16px;margin:20px 0 6px}</style></head>
    <body>${html}</body></html>`)
  d.close()
  setTimeout(() => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 60000)
  }, 200)
}

/* -------- форма резолюции (УДО) -------- */

function ResolutionForm({ t, doc, onDone }) {
  const [executors, setExecutors] = useState([])
  const [type, setType] = useState('execution')
  const [deadline, setDeadline] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const makeLead = (u) => setExecutors([u, ...executors.filter((x) => x.id !== u.id)])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const d = await api(`/documents/${doc.id}/resolution/`, {
        method: 'POST',
        json: { executor_ids: executors.map((u) => u.id), type, deadline: deadline || null, text },
      })
      onDone(d)
    } catch (ex) {
      setError(t(ex.data?.code || 'loadError'))
      setBusy(false)
    }
  }

  return (
    <section className="card res-card">
      <div className="res-head">
        <h2 className="card-title">{t('resolution')}</h2>
        <span className="pill">{t('needsResolution')}</span>
      </div>

      <div className="field-label">{t('signsResolution')}</div>
      {doc.signer ? <UserChip user={doc.signer} badge={t('forSignature')} /> : <p className="alert">{t('noSigner')}</p>}

      <div className="field-label">{t('tabExecutors')} <b className="req">*</b></div>
      <div className="exec-list">
        {executors.map((u, i) => (
          <div key={u.id} className="exec-row">
            <UserChip
              user={u}
              badge={i === 0 ? t('leadExecutor') : null}
              onRemove={() => setExecutors(executors.filter((x) => x.id !== u.id))}
            />
            {i > 0 && (
              <button type="button" className="link-btn small" onClick={() => makeLead(u)}>{t('makeLead')}</button>
            )}
          </div>
        ))}
      </div>
      <div className="exec-add">
        <UserPicker
          t={t}
          role="executor"
          exclude={executors.map((u) => u.id)}
          placeholder={t('searchFio')}
          onSelect={(u) => setExecutors([...executors, u])}
        />
      </div>
      <p className="muted small">{t('leadHint')}</p>

      <div className="res-opts">
        <div className="opt">
          <span className="opt-title">{t('resType')}</span>
          <div className="opt-row">
            {['execution', 'info'].map((v) => (
              <label key={v} className={'check' + (type === v ? ' strong' : '')}>
                <input type="radio" name="rtype" checked={type === v} onChange={() => setType(v)} />{t('res_' + v)}
              </label>
            ))}
          </div>
        </div>
        <label className="opt">
          <span className="opt-title">{t('deadline')}</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>{t('resText')}</span>
        <textarea rows="4" value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      {error && <div className="alert">{error}</div>}

      <div className="form-actions">
        <button className="btn primary" disabled={busy || executors.length === 0 || !doc.signer} onClick={submit}>
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 12l16-8-6 16-2-6z" {...s} /></svg>
          {t('sendToSign')}
        </button>
        {executors.length === 0 && <span className="muted small">{t('executorsRequired')}</span>}
      </div>
    </section>
  )
}

/* -------- карточка резолюции -------- */

function ExecutorsTab({ t, doc }) {
  const [onlyNotAck, setOnlyNotAck] = useState(false)
  const [closed, setClosed] = useState({})
  const list = doc.executors.filter((e) => !onlyNotAck || !e.acknowledged_at)
  const groups = {}
  list.forEach((e) => { (groups[e.department || '—'] ||= []).push(e) })

  const print = () => printHtml(t('tabExecutors'), `
    <h1>${esc(doc.kind)} №${esc(doc.number)}</h1><div class="muted">${esc(doc.subject)}</div>
    <h2>${esc(t('tabExecutors'))}</h2>
    <table>${doc.executors.map((e) => `<tr><td>${esc(e.department)}</td><td>${esc(e.full_name)}${e.is_lead ? ' (' + esc(t('leadExecutor')) + ')' : ''}</td>
      <td>${e.acknowledged_at ? esc(t('acknowledged')) : esc(t('notAcknowledged'))}</td></tr>`).join('')}</table>`)

  return (
    <div>
      <div className="exec-head">
        <span className="muted">{t('tabExecutors')}</span>
        <div className="exec-head-right">
          <button type="button" className="link-btn small" onClick={print}><PrintIcon />{t('print')}</button>
          <label className="check small">
            <input type="checkbox" checked={onlyNotAck} onChange={(e) => setOnlyNotAck(e.target.checked)} />
            {t('showNotAck')}
          </label>
        </div>
      </div>
      {list.length === 0 && <p className="empty">{t('emptyList')}</p>}
      {Object.entries(groups).map(([dep, people]) => (
        <div key={dep} className="dep-group">
          <button type="button" className="dep-title" onClick={() => setClosed({ ...closed, [dep]: !closed[dep] })}>
            {dep}
            <svg viewBox="0 0 24 24" width="14" height="14" style={{ transform: closed[dep] ? 'rotate(180deg)' : 'none' }}><path d="M6 15l6-6 6 6" {...s} /></svg>
          </button>
          {!closed[dep] && (
            <div className="dep-box">
              {people.map((e) => (
                <span key={e.id} className="person-tag" title={e.acknowledged_at ? `${t('acknowledged')}: ${fmtDate(e.acknowledged_at)}` : t('notAcknowledged')}>
                  {e.acknowledged_at && <span className="mark ok" title={t('acknowledged')}>{t('markAck')}</span>}
                  {e.is_lead && <span className="mark lead" title={t('leadExecutor')}>{t('markLead')}</span>}
                  {e.full_name}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="legend muted small">
        <span><span className="mark ok">{t('markAck')}</span> {t('acknowledged')}</span>
        <span><span className="mark lead">{t('markLead')}</span> {t('leadExecutor')}</span>
      </div>
    </div>
  )
}

function Timeline({ t, lang, doc }) {
  return (
    <ol className="timeline">
      {doc.timeline.map((e, i) => (
        <li key={i} className={'tl-item tl-' + e.event}>
          <span className="tl-dot" />
          <div>
            <div className="strong">{t('ev_' + e.event)}</div>
            <div className="muted small">{e.user?.full_name} · {fmtDate(e.at, lang)}</div>
            {e.note && <div className="tl-note">{e.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function ResolutionCard({ t, lang, doc, onSign, onClose, onArchive, busy }) {
  const [tab, setTab] = useState('exec')
  const r = doc.resolution
  const archived = doc.status === 'archived'
  const closed = doc.status === 'closed' || archived
  const signed = doc.status === 'signed' || closed
  const statusKey = archived ? 'status_archived' : closed ? 'status_closed' : signed ? (r.type === 'info' ? 'resStInfo' : 'resStExec') : 'resStSigning'

  const print = () => printHtml(`${t('resolution')} 1`, `
    <h1>${esc(t('resolution'))} 1 — ${esc(t(statusKey))}</h1>
    <div class="muted">${esc(doc.kind)} №${esc(doc.number)} · ${esc(doc.subject)}</div>
    <div class="text">${esc(r.text || '—')}</div>
    <table>
      <tr><td>${esc(t('resAuthor'))}</td><td>${esc(r.author?.full_name)}</td></tr>
      <tr><td>${esc(t('preparedBy'))}</td><td>${esc(r.prepared_by?.full_name)}</td></tr>
      <tr><td>${esc(t('issuedAt'))}</td><td>${esc(fmtDate(r.created_at, lang))}</td></tr>
      <tr><td>${esc(t('leadExecutor'))}</td><td>${esc(r.lead?.full_name)}</td></tr>
      <tr><td>${esc(t('resType'))}</td><td>${esc(t('res_' + r.type))}</td></tr>
      ${r.deadline ? `<tr><td>${esc(t('deadline'))}</td><td>${esc(new Date(r.deadline).toLocaleDateString())}</td></tr>` : ''}
      <tr><td>${esc(t('signature'))}</td><td>${signed ? esc(t('status_signed')) + ' · ' + esc(doc.signed_by?.full_name) + ' · ' + esc(fmtDate(doc.signed_at, lang)) : esc(t('notSignedYet'))}</td></tr>
      <tr><td>${esc(t('tabExecutors'))}</td><td>${doc.executors.map((e) => esc(e.full_name)).join(', ')}</td></tr>
    </table>`)

  return (
    <section className="card res-card res-view">
      <div className="res-main">
        <span className="res-badge">{t('mainResolution')}</span>
        <div className="res-head">
          <h2 className="card-title">{t('resolution')} 1</h2>
          <span className={'pill ' + (signed ? 'amber' : 'grey')}>{t(statusKey)}</span>
          <button type="button" className="link-btn small push" onClick={print}><PrintIcon />{t('print')}</button>
        </div>

        <div className="res-author">
          <span className="avatar xl">{initials(r.author?.full_name)}</span>
          <div className="res-author-body">
            <div className="muted small">{t('resAuthor')}</div>
            <div className="res-author-name">{r.author?.full_name}</div>
            <div className="muted small">{r.author?.position}</div>
            <div className="res-text">{r.text || <span className="muted">—</span>}</div>
          </div>
        </div>

        <dl className="res-fields">
          <div><dt>{t('preparedBy')}</dt><dd>{r.prepared_by?.full_name}</dd></div>
          <div><dt>{t('issuedAt')}</dt><dd>{fmtDate(r.created_at, lang)}</dd></div>
          <div><dt>{t('leadExecutor')}</dt><dd>{r.lead?.full_name}</dd></div>
          {r.deadline && <div><dt>{t('deadline')}</dt><dd>{new Date(r.deadline).toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU')}</dd></div>}
          <div><dt>&nbsp;</dt><dd>{t('res_' + r.type)}</dd></div>
        </dl>

        {doc.can.sign && (
          <div className="form-actions">
            <button className="btn primary" disabled={busy} onClick={onSign}>
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 17c3 0 4-6 6-6s1 5 3 5 2-3 4-3 2 2 5 2M3 21h18" {...s} /></svg>
              {t('signBtn')}
            </button>
          </div>
        )}
        {doc.can.close && (
          <div className="form-actions">
            <button className="btn primary" disabled={busy} onClick={onClose}>
              <svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="4" width="18" height="5" rx="1" {...s} /><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" {...s} /></svg>
              {t('closeBtn')}
            </button>
            <span className="muted small">{t('closeHint')}</span>
          </div>
        )}
        {closed && (
          <p className="muted small">{t('closedBy')}: <b>{doc.closed_by?.full_name}</b> · {fmtDate(doc.closed_at, lang)}</p>
        )}
        {archived && (
          <p className="muted small">{t('archivedBy')}: <b>{doc.archived_by?.full_name}</b> · {fmtDate(doc.archived_at, lang)}</p>
        )}
        {doc.can.archive && (
          <div className="form-actions">
            <button className="btn primary" disabled={busy} onClick={onArchive}>
              <svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="4" width="18" height="5" rx="1" {...s} /><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" {...s} /></svg>
              {t('archiveBtn')}
            </button>
          </div>
        )}
        {!signed && !doc.can.sign && (
          <p className="muted small">{t('waitingSignOf')}: <b>{doc.signer?.full_name}</b></p>
        )}
      </div>

      <div className="res-tabs">
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>{t('timeline')}</button>
        <button className={tab === 'exec' ? 'active' : ''} onClick={() => setTab('exec')}>{t('tabExecutors')}</button>
      </div>
      <div className="res-tab-body">
        {tab === 'timeline' ? <Timeline t={t} lang={lang} doc={doc} /> : <ExecutorsTab t={t} doc={doc} />}
      </div>
    </section>
  )
}

async function postAction(id, path, opts, { t, onChange, setBusy, setError }) {
  setBusy(true)
  setError('')
  try {
    onChange(await api(`/documents/${id}/${path}/`, { method: 'POST', ...opts }))
  } catch (ex) {
    setError(t(ex.data?.code || 'loadError'))
    setBusy(false)
  }
}

function ReworkCard({ t, lang, doc, onChange }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resubmit = () => {
    const form = new FormData()
    if (file) form.append('official', file)
    postAction(doc.id, 'resubmit', { form }, { t, onChange, setBusy, setError })
  }

  return (
    <section className="card res-card">
      <div className="res-head">
        <h2 className="card-title">{t('registration')}</h2>
        <span className="status st-rework">{t('status_rework')}</span>
      </div>
      <div className="field-label">{t('reworkComment')}</div>
      <div className="note-box">{doc.return_comment}</div>
      <dl className="info one">
        <dt>{t('returnedBy')}</dt><dd>{doc.returned_by?.full_name || '—'}</dd>
        <dt>{t('returnedAt')}</dt><dd>{fmtDate(doc.returned_at, lang)}</dd>
      </dl>
      {doc.can.resubmit ? (
        <>
          <label className="field">
            <span>{t('replaceOfficial')}</span>
            <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
          {error && <div className="alert">{error}</div>}
          <div className="form-actions">
            <button className="btn primary" disabled={busy} onClick={resubmit}>
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 12l16-8-6 16-2-6z" {...s} /></svg>
              {t('resubmitBtn')}
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">{t('waitingAuthorRework')}</p>
      )}
    </section>
  )
}

function RegistrationCard({ t, lang, doc, onChange }) {
  const [mode, setMode] = useState(null) // null | 'reject' | 'rework'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const act = (path, json) => postAction(doc.id, path, { json }, { t, onChange, setBusy, setError })
  const cancel = () => { setMode(null); setReason(''); setError('') }

  return (
    <section className="card res-card">
      <h2 className="card-title">{t('registration')}</h2>
      {doc.return_comment && doc.returned_at && (
        <div className="note-box">
          <div className="muted small">{t('wasReturned')} · {fmtDate(doc.returned_at, lang)}</div>
          {doc.return_comment}
        </div>
      )}
      <p className="muted">{doc.can.register ? t('registrationHint') : t('awaitingRegistrationText')}</p>
      <dl className="info one">
        <dt>{t('submittedBy')}</dt><dd>{doc.created_by.full_name} <span className="muted">· {doc.created_by.department}</span></dd>
        <dt>{t('submittedAt')}</dt><dd>{fmtDate(doc.created_at, lang)}</dd>
      </dl>
      {doc.signer && (
        <>
          <div className="field-label">{t('signsResolution')}</div>
          <UserChip user={doc.signer} badge={t('forSignature')} />
        </>
      )}

      {doc.can.register && (
        <>
          {mode && (
            <label className="field">
              <span>{t(mode === 'reject' ? 'rejectReason' : 'reworkComment')}</span>
              <textarea rows="3" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          )}
          {error && <div className="alert">{error}</div>}
          <div className="form-actions wrap">
            {mode === 'reject' && (
              <button className="btn danger" disabled={busy || !reason.trim()} onClick={() => act('reject', { reason })}>
                {t('rejectConfirm')}
              </button>
            )}
            {mode === 'rework' && (
              <button className="btn warn" disabled={busy || !reason.trim()} onClick={() => act('rework', { comment: reason })}>
                {t('reworkConfirm')}
              </button>
            )}
            {mode ? (
              <button className="btn ghost" disabled={busy} onClick={cancel}>{t('cancel')}</button>
            ) : (
              <>
                <button className="btn primary" disabled={busy} onClick={() => act('register')}>
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12l5 5 9-10" {...s} /></svg>
                  {t('registerDocBtn')}
                </button>
                <button className="btn ghost warn-text" disabled={busy} onClick={() => setMode('rework')}>{t('reworkBtn')}</button>
                <button className="btn ghost danger-text" disabled={busy} onClick={() => setMode('reject')}>{t('rejectBtn')}</button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function RejectedCard({ t, lang, doc }) {
  return (
    <section className="card res-card">
      <div className="res-head">
        <h2 className="card-title">{t('registration')}</h2>
        <span className="status st-rejected">{t('status_rejected')}</span>
      </div>
      <div className="field-label">{t('rejectReason')}</div>
      <div className="reject-reason">{doc.reject_reason}</div>
      <dl className="info one">
        <dt>{t('rejectedBy')}</dt><dd>{doc.rejected_by?.full_name || '—'}</dd>
        <dt>{t('rejectedAt')}</dt><dd>{fmtDate(doc.rejected_at, lang)}</dd>
      </dl>
    </section>
  )
}

export default function ResolutionPanel({ t, lang, doc, onChange, onSign, onClose, onArchive, busy }) {
  if (doc.status === 'pending') return <RegistrationCard t={t} lang={lang} doc={doc} onChange={onChange} />
  if (doc.status === 'rework') return <ReworkCard t={t} lang={lang} doc={doc} onChange={onChange} />
  if (doc.status === 'rejected') return <RejectedCard t={t} lang={lang} doc={doc} />
  if (doc.status === 'registered') {
    if (doc.can.resolve) return <ResolutionForm t={t} doc={doc} onDone={onChange} />
    return (
      <section className="card res-card">
        <h2 className="card-title">{t('resolution')}</h2>
        <p className="empty">{t('resolutionNotYet')}</p>
        {doc.signer && (
          <>
            <div className="field-label">{t('signsResolution')}</div>
            <UserChip user={doc.signer} badge={t('forSignature')} />
          </>
        )}
      </section>
    )
  }
  return <ResolutionCard t={t} lang={lang} doc={doc} onSign={onSign} onClose={onClose} onArchive={onArchive} busy={busy} />
}
