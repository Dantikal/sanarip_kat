import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { fmtDate } from './DocumentList.jsx'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const EXT = ['.pdf', '.doc', '.docx']

function fileIcon(name = '') {
  return name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc'
}

export default function Library({ t, lang, category, canEdit }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const input = useRef(null)

  useEffect(() => {
    setItems(null)
    setError('')
    setFormOpen(false)
    api('/library/?category=' + category).then(setItems).catch(() => setError(t('loadError')))
  }, [category])

  const resetForm = () => {
    setName('')
    setText('')
    setFile(null)
    setFormOpen(false)
  }

  const pickFile = (f) => {
    if (!f) return
    if (!EXT.some((x) => f.name.toLowerCase().endsWith(x))) {
      setError(`${t('badFile')}: ${f.name}`)
      return
    }
    setError('')
    setFile(f)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData()
    fd.append('category', category)
    fd.append('name', name.trim())
    fd.append('text', text)
    if (file) fd.append('file', file)
    try {
      const item = await api('/library/', { method: 'POST', form: fd })
      setItems([item, ...items])
      resetForm()
    } catch (ex) {
      setError(ex.data?.code === 'badFile' ? `${t('badFile')}: ${ex.data.file}` : t(ex.data?.code || 'loadError'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (item) => {
    if (!confirm(t('confirmDelete') + '\n\n' + item.name)) return
    try {
      await api(`/library/${item.id}/`, { method: 'DELETE' })
      setItems(items.filter((x) => x.id !== item.id))
    } catch (ex) {
      setError(t(ex.data?.code || 'loadError'))
    }
  }

  return (
    <>
      <div className="lib-head">
        <h2 className="card-title">{t('reg_' + category)}</h2>
        {canEdit && !formOpen && (
          <button className="btn primary" onClick={() => setFormOpen(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" {...s} /></svg>
            {t('add')}
          </button>
        )}
      </div>

      {canEdit && formOpen && (
        <form className="lib-form" onSubmit={submit}>
          <label className="field">
            <span>{t('libName')} <b className="req">*</b></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>{t('libText')}</span>
            <textarea rows="5" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="field-label">{t('libFile')} (.pdf, .doc, .docx)</div>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]) }}
          >
            <span className="dz-hint">{file ? file.name : t('dropHere')}</span>
            {file ? (
              <button type="button" className="chip-x" onClick={() => setFile(null)}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>
              </button>
            ) : (
              <button type="button" className="btn soft" onClick={() => input.current.click()}>{t('chooseFile')}</button>
            )}
            <input ref={input} type="file" hidden accept={EXT.join(',')} onChange={(e) => { pickFile(e.target.files[0]); e.target.value = '' }} />
          </div>
          <p className="muted small">{t('textOrFileHint')}</p>
          <div className="form-actions">
            <button className="btn primary" disabled={busy || !name.trim() || (!text.trim() && !file)}>{t('save')}</button>
            <button type="button" className="btn ghost" onClick={resetForm}>{t('cancel')}</button>
          </div>
        </form>
      )}

      {error && <div className="alert">{error}</div>}
      {!items && !error && <p className="empty">{t('loading')}</p>}
      {items && items.length === 0 && <p className="empty">{t('emptyList')}</p>}

      <div className="lib-list">
        {items?.map((item) => (
          <div key={item.id} className="lib-item">
            <div className={'lib-icon ' + (item.file_name ? fileIcon(item.file_name) : 'txt')}>
              {item.file_name ? fileIcon(item.file_name).toUpperCase() : 'TXT'}
            </div>
            <div className="lib-body">
              <div className="lib-name">{item.name}</div>
              <div className="muted small">
                {item.created_by?.full_name} · {fmtDate(item.created_at, lang)}
                {item.file_name && <> · {item.file_name}</>}
              </div>
              {item.text && (
                <>
                  <div className={'lib-text' + (expanded === item.id ? ' open' : '')}>{item.text}</div>
                  <button className="link-btn small" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    {expanded === item.id ? t('collapse') : t('showText')}
                  </button>
                </>
              )}
            </div>
            <div className="lib-actions">
              {item.download_url && (
                <a className="btn soft" href={item.download_url} download>
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...s} /></svg>
                  {t('download')}
                </a>
              )}
              {canEdit && (
                <button className="kind-del visible" title={t('delete')} onClick={() => remove(item)}>
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" {...s} /></svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
