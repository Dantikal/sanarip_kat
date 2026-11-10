import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import UserPicker, { UserChip } from './UserPicker.jsx'
import Library from './Library.jsx'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const EXT = ['.pdf', '.doc', '.docx']

export default function RegisterPage({ t, lang, user, onRegistered }) {
  const [tab, setTab] = useState('new')
  const [kinds, setKinds] = useState(null)
  const [kind, setKind] = useState(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const isUdo = user.role === 'udo'

  useEffect(() => {
    api('/kinds/').then(setKinds).catch(() => setError(t('loadError')))
  }, [])

  const addKind = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const k = await api('/kinds/', { method: 'POST', json: { name: newName.trim() } })
      setKinds([...kinds, k])
      setNewName('')
      setError('')
    } catch (ex) {
      setError(t(ex.data?.code || 'loadError'))
    }
  }

  const removeKind = async (k) => {
    if (!confirm(t('confirmDeleteKind') + '\n\n' + k.name)) return
    try {
      await api(`/kinds/${k.id}/`, { method: 'DELETE' })
      setKinds(kinds.filter((x) => x.id !== k.id))
      setError('')
    } catch (ex) {
      setError(t(ex.data?.code || 'loadError'))
    }
  }

  if (kind) {
    return <RegisterForm t={t} kind={kind} onBack={() => setKind(null)} onRegistered={onRegistered} />
  }

  return (
    <div className="reg-layout">
      <nav className="reg-nav">
        {['new', 'templates', 'blanks'].map((id) => (
          <button key={id} className={'subitem' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>
            {t('reg_' + id)}
          </button>
        ))}
      </nav>

      <section className="card reg-card">
        {tab !== 'new' ? (
          <Library t={t} lang={lang} category={tab} canEdit={isUdo} />
        ) : (
          <>
            <h2 className="card-title">{t('chooseKind')}</h2>
            <div className="kind-cat">{t('catOutgoing')}</div>

            {!kinds && !error && <p className="empty">{t('loading')}</p>}
            <div className="kind-list">
              {kinds?.map((k) => (
                <div key={k.id} className="kind-row">
                  <button className="kind" onClick={() => setKind(k)}>{k.name}</button>
                  {isUdo && (
                    <button className="kind-del" title={t('delete')} onClick={() => removeKind(k)}>
                      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" {...s} /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isUdo && (
              <form className="kind-add" onSubmit={addKind}>
                <input
                  type="text"
                  value={newName}
                  placeholder={t('newKindPlaceholder')}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <button className="btn primary" disabled={!newName.trim()}>
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" {...s} /></svg>
                  {t('add')}
                </button>
              </form>
            )}
            {error && <div className="alert">{error}</div>}
          </>
        )}
      </section>
    </div>
  )
}

/* ---------------- form ---------------- */

function Dropzone({ t, files, multiple, onChange, onBadFile }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)

  const accept = (list) => {
    const arr = Array.from(list)
    const bad = arr.find((f) => !EXT.some((x) => f.name.toLowerCase().endsWith(x)))
    if (bad) return onBadFile(bad.name)
    onChange(multiple ? [...files, ...arr] : arr.slice(0, 1))
  }

  return (
    <div>
      <div
        className={'dropzone' + (over ? ' over' : '')}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); accept(e.dataTransfer.files) }}
      >
        <span className="dz-hint">{t('dropHere')}</span>
        <button type="button" className="btn soft" onClick={() => input.current.click()}>
          {t('chooseFile')}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          multiple={multiple}
          accept={EXT.join(',')}
          onChange={(e) => { accept(e.target.files); e.target.value = '' }}
        />
      </div>
      {files.map((f, i) => (
        <div key={i} className="file-row">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" {...s} strokeWidth="1.6" /></svg>
          <span className="file-name">{f.name}</span>
          <button type="button" className="chip-x" onClick={() => onChange(files.filter((_, j) => j !== i))}>
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>
          </button>
        </div>
      ))}
    </div>
  )
}

function Section({ title, badge, open, onToggle, children }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
        {onToggle && (
          <button type="button" className="toggle" onClick={onToggle} aria-expanded={open}>
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ transform: open ? 'none' : 'rotate(180deg)' }}><path d="M6 15l6-6 6 6" {...s} /></svg>
          </button>
        )}
        {badge && <span className="pill">{badge}</span>}
      </div>
      {open !== false && children}
    </section>
  )
}

function RegisterForm({ t, kind, onBack, onRegistered }) {
  const [refs, setRefs] = useState({ organizations: [], mailings: [] })
  const [files, setFiles] = useState({ official: [], appendix: [], internal: [] })
  const [subject, setSubject] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [onControl, setOnControl] = useState(false)
  const [view, setView] = useState('normal')
  const [langs, setLangs] = useState([])
  const [urgency, setUrgency] = useState('normal')
  const [recipients, setRecipients] = useState([{ type: 'org', name: '' }])
  const [recOpen, setRecOpen] = useState(true)
  const [signer, setSigner] = useState(null)
  const [approvers, setApprovers] = useState([])
  const [openForm, setOpenForm] = useState(true)
  const [openAppr, setOpenAppr] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hideMissing, setHideMissing] = useState(false)

  useEffect(() => {
    api('/references/').then(setRefs).catch(() => {})
  }, [])

  const missing = []
  if (!subject.trim()) missing.push('subject')
  if (!content.trim()) missing.push('content')
  if (!langs.length) missing.push('docLanguage')
  if (!recipients.some((r) => r.name.trim())) missing.push('recipients')
  if (!signer) missing.push('approvers')
  if (!files.official.length) missing.push('officialDoc')
  const filesMissing = !files.official.length
  const formMissing = missing.some((m) => ['subject', 'content', 'docLanguage', 'recipients'].includes(m))

  const toggleLang = (id) => setLangs(langs.includes(id) ? langs.filter((x) => x !== id) : [...langs, id])
  const setRec = (i, patch) => setRecipients(recipients.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const submit = async () => {
    if (missing.length) return
    setBusy(true)
    setError('')
    const fd = new FormData()
    fd.append('kind', kind.id)
    fd.append('subject', subject)
    fd.append('tags', tags)
    fd.append('content', content)
    fd.append('on_control', onControl ? 'true' : 'false')
    fd.append('view', view)
    fd.append('languages', JSON.stringify(langs))
    fd.append('urgency', urgency)
    fd.append('recipients', JSON.stringify(recipients.filter((r) => r.name.trim())))
    fd.append('approvers', JSON.stringify([signer, ...approvers].map((a) => a.id)))
    fd.append('official', files.official[0])
    files.appendix.forEach((f) => fd.append('appendix', f))
    files.internal.forEach((f) => fd.append('internal', f))
    try {
      const doc = await api('/documents/', { method: 'POST', form: fd })
      onRegistered(doc)
    } catch (ex) {
      setError(ex.data?.code === 'badFile' ? `${t('badFile')}: ${ex.data.file}` : ex.data?.code === 'signerNotAdmin' ? t('signerNotAdmin') : ex.data?.error || t('loadError'))
      setBusy(false)
    }
  }

  const badFile = (name) => setError(`${t('badFile')}: ${name}`)

  return (
    <div className="reg-form">
      <div className="reg-top">
        <button className="back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 6l-6 6 6 6" {...s} /></svg>
          {t('back')}
        </button>
        <div className="reg-title">
          {kind.name} <span className="pill">{t('noPaper')}</span>
        </div>
        <div className="req-note"><b>*</b> — {t('requiredNote')}</div>
      </div>

      <div className="reg-grid">
        <Section title={t('attachFile')} badge={filesMissing ? t('mustFill') : null}>
          <p className="muted">{t('allowedFormats')}: .pdf, .doc, .docx</p>
          <div className="field-label">{t('officialDoc')} <b className="req">*</b></div>
          <Dropzone t={t} files={files.official} onChange={(f) => setFiles({ ...files, official: f })} onBadFile={badFile} />
          <div className="field-label">{t('appendix')}</div>
          <Dropzone t={t} multiple files={files.appendix} onChange={(f) => setFiles({ ...files, appendix: f })} onBadFile={badFile} />
          <div className="field-label">{t('internalAppendix')}</div>
          <Dropzone t={t} multiple files={files.internal} onChange={(f) => setFiles({ ...files, internal: f })} onBadFile={badFile} />
        </Section>

        <div className="reg-right">
          <Section title={t('fillForm')} badge={formMissing ? t('mustFill') : null} open={openForm} onToggle={() => setOpenForm(!openForm)}>
            <label className="field">
              <span>{t('subject')} <b className="req">*</b></span>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('tags')}</span>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('content')} <b className="req">*</b></span>
              <textarea rows="3" value={content} onChange={(e) => setContent(e.target.value)} />
            </label>

            <div className="opts">
              <div className="opt">
                <span className="opt-title">{t('features')}</span>
                <label className="check"><input type="checkbox" checked={onControl} onChange={(e) => setOnControl(e.target.checked)} />{t('onControl')}</label>
              </div>
              <div className="opt">
                <span className="opt-title">{t('docView')}</span>
                <div className="opt-row">
                  {['normal', 'info', 'answer'].map((v) => (
                    <label key={v} className={'check' + (view === v ? ' strong' : '')}>
                      <input type="radio" name="view" checked={view === v} onChange={() => setView(v)} />{t('view_' + v)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="opt">
                <span className="opt-title">{t('docLanguage')} <b className="req">*</b></span>
                <div className="opt-row">
                  {['state', 'official', 'foreign'].map((l) => (
                    <label key={l} className="check">
                      <input type="checkbox" checked={langs.includes(l)} onChange={() => toggleLang(l)} />{t('lang_' + l)}
                    </label>
                  ))}
                </div>
              </div>
              <label className="opt">
                <span className="opt-title">{t('urgency')} <b className="req">*</b></span>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                  {['normal', 'urgent', 'very_urgent'].map((u) => <option key={u} value={u}>{t('urg_' + u)}</option>)}
                </select>
              </label>
            </div>

            <div className="rec-head">
              <span>{t('recipients')} <b className="req">*</b></span>
              <button type="button" className="toggle" onClick={() => setRecOpen(!recOpen)}>
                <svg viewBox="0 0 24 24" width="16" height="16" style={{ transform: recOpen ? 'none' : 'rotate(180deg)' }}><path d="M6 15l6-6 6 6" {...s} /></svg>
              </button>
              <button type="button" className="link-btn" onClick={() => setRecipients([...recipients, { type: 'org', name: '' }])}>
                <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="9" cy="8" r="4" {...s} strokeWidth="1.6" /><path d="M2 21a7 7 0 0 1 12-5M19 14v6M16 17h6" {...s} strokeWidth="1.6" /></svg>
                {t('add')}
              </button>
            </div>

            {recOpen && recipients.map((r, i) => (
              <div key={i} className="rec-box">
                <span className="pill rec-pill">{t('recipient')} {i + 1}</span>
                {recipients.length > 1 && (
                  <button type="button" className="chip-x rec-x" onClick={() => setRecipients(recipients.filter((_, j) => j !== i))}>
                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>
                  </button>
                )}
                <div className="rec-tabs">
                  {['org', 'person', 'mailing'].map((type) => (
                    <button type="button" key={type} className={r.type === type ? 'active' : ''} onClick={() => setRec(i, { type, name: '' })}>
                      {t('rec_' + type)}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>{t('recLabel_' + r.type)}</span>
                  {r.type === 'person' ? (
                    <input type="text" value={r.name} onChange={(e) => setRec(i, { name: e.target.value })} />
                  ) : (
                    <select value={r.name} className={r.name ? '' : 'placeholder'} onChange={(e) => setRec(i, { name: e.target.value })}>
                      <option value="">{t('choose')}</option>
                      {(r.type === 'org' ? refs.organizations : refs.mailings).map((x) => <option key={x}>{x}</option>)}
                    </select>
                  )}
                </label>
              </div>
            ))}
          </Section>

          <Section title={t('chooseApprovers')} badge={signer ? null : t('mustFill')} open={openAppr} onToggle={() => setOpenAppr(!openAppr)}>
            <div className="field-label">{t('chooseSigner')} <b className="req">*</b></div>
            <ol className="steps">
              <li className={'step' + (signer ? '' : ' pending')}>
                <span className="step-num">1</span>
                {signer ? (
                  <UserChip user={signer} badge={t('forSignature')} onRemove={() => setSigner(null)} />
                ) : (
                  <UserPicker
                    t={t}
                    admin
                    exclude={approvers.map((a) => a.id)}
                    placeholder={t('chooseSignerPh')}
                    onSelect={setSigner}
                  />
                )}
              </li>
              {approvers.map((a, i) => (
                <li key={a.id} className="step">
                  <span className="step-num">{i + 2}</span>
                  <UserChip user={a} onRemove={() => setApprovers(approvers.filter((x) => x.id !== a.id))} />
                </li>
              ))}
              {signer && (
                <li className="step pending">
                  <span className="step-num">{approvers.length + 2}</span>
                  <UserPicker
                    t={t}
                    exclude={[signer.id, ...approvers.map((a) => a.id)]}
                    placeholder={t('searchFio')}
                    onSelect={(u) => setApprovers([...approvers, u])}
                  />
                </li>
              )}
            </ol>
            <p className="muted small">{t('signerAdminHint')}</p>
          </Section>

          {missing.length > 0 && !hideMissing && (
            <div className="alert">
              {t('fillRequired')}: {missing.map((m) => t(m)).join(', ')}
              <button type="button" className="chip-x" onClick={() => setHideMissing(true)}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>
              </button>
            </div>
          )}
          {error && <div className="alert">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn primary" disabled={missing.length > 0 || busy} onClick={submit}>
              {t('registerBtn')}
            </button>
            <button type="button" className="btn ghost" onClick={onBack}>{t('cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
