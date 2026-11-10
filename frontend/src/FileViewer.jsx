import { useEffect, useRef, useState } from 'react'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

let pdfjsPromise = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

function typeOf(name = '') {
  const n = name.toLowerCase()
  if (n.endsWith('.pdf')) return 'pdf'
  if (n.endsWith('.docx')) return 'docx'
  return 'other'
}

function Tool({ title, onClick, disabled, children }) {
  return (
    <button type="button" className="fv-tool" title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default function FileViewer({ t, attachments }) {
  const [idx, setIdx] = useState(0)
  const [blob, setBlob] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [state, setState] = useState('loading')
  const [full, setFull] = useState(false)
  const root = useRef(null)
  const stage = useRef(null)
  const canvas = useRef(null)
  const docxBody = useRef(null)
  const docxStyle = useRef(null)
  const renderTask = useRef(null)

  const att = attachments[idx]
  const type = typeOf(att?.name)

  // загрузка файла
  useEffect(() => {
    if (!att) return
    let cancelled = false
    setBlob(null)
    setPdf(null)
    setPage(1)
    setPageInput('1')
    setZoom(1)
    setRotation(0)
    setState('loading')
    fetch(att.url, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(r.status)
        return r.blob()
      })
      .then((b) => {
        if (cancelled) return
        setBlob(b)
        if (type === 'other') setState('unsupported')
      })
      .catch(() => !cancelled && setState('error'))
    return () => { cancelled = true }
  }, [att?.id])

  // PDF: открыть документ
  useEffect(() => {
    if (!blob || type !== 'pdf') return
    let cancelled = false
    let doc = null
    loadPdfjs()
      .then(async (pdfjs) => {
        doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise
        if (cancelled) return doc.destroy()
        setPdf(doc)
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
      doc?.destroy()
    }
  }, [blob])

  // PDF: отрисовать страницу
  useEffect(() => {
    if (!pdf || !canvas.current) return
    let cancelled = false
    ;(async () => {
      const p = await pdf.getPage(page)
      if (cancelled) return
      const base = p.getViewport({ scale: 1, rotation: 0 })
      const avail = Math.max(200, (stage.current?.clientWidth || 800) - 48)
      const fit = Math.min(avail / base.width, 1.6)
      const viewport = p.getViewport({ scale: fit * zoom, rotation })
      const ratio = window.devicePixelRatio || 1
      const c = canvas.current
      c.width = Math.floor(viewport.width * ratio)
      c.height = Math.floor(viewport.height * ratio)
      c.style.width = Math.floor(viewport.width) + 'px'
      c.style.height = Math.floor(viewport.height) + 'px'
      renderTask.current?.cancel()
      const task = p.render({
        canvasContext: c.getContext('2d'),
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      })
      renderTask.current = task
      try {
        await task.promise
        if (!cancelled) setState('ready')
      } catch { /* cancelled */ }
    })()
    return () => { cancelled = true }
  }, [pdf, page, zoom, rotation, full])

  // DOCX
  useEffect(() => {
    if (!blob || type !== 'docx') return
    let cancelled = false
    import('docx-preview')
      .then(({ renderAsync }) => {
        if (cancelled) return
        docxBody.current.innerHTML = ''
        docxStyle.current.innerHTML = ''
        return renderAsync(blob, docxBody.current, docxStyle.current, {
          className: 'docx',
          inWrapper: true,
          breakPages: true,
        })
      })
      .then(() => !cancelled && setState('ready'))
      .catch(() => !cancelled && setState('error'))
    return () => { cancelled = true }
  }, [blob])

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => setPageInput(String(page)), [page])

  if (!attachments.length) return <p className="empty">{t('noFiles')}</p>

  const pages = pdf?.numPages || 1
  const goPage = (n) => setPage(Math.min(pages, Math.max(1, n)))

  const print = () => {
    if (!blob) return
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)
    const cleanup = () => setTimeout(() => frame.remove(), 60000)
    if (type === 'pdf') {
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      frame.onload = () => {
        frame.contentWindow.focus()
        frame.contentWindow.print()
        cleanup()
      }
      frame.src = url
    } else if (type === 'docx') {
      const d = frame.contentDocument
      d.open()
      d.write(`<!doctype html><html><head><meta charset="utf-8">${docxStyle.current.innerHTML}
        <style>body{margin:0;background:#fff}.docx-wrapper{background:#fff!important;padding:0!important}
        .docx-wrapper>section.docx{box-shadow:none!important;margin:0 auto!important}</style></head>
        <body>${docxBody.current.innerHTML}</body></html>`)
      d.close()
      setTimeout(() => {
        frame.contentWindow.focus()
        frame.contentWindow.print()
        cleanup()
      }, 300)
    }
  }

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else root.current?.requestFullscreen?.()
  }

  const canView = type !== 'other'
  const docxTransform = `scale(${zoom}) rotate(${rotation}deg)`

  return (
    <div className={'fv' + (full ? ' full' : '')} ref={root}>
      <select className="fv-select" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
        {attachments.map((a, i) => (
          <option key={a.id} value={i}>{i + 1}. {a.name} ({t('file_' + a.kind)})</option>
        ))}
      </select>

      <div className="fv-bar">
        <div className="fv-group">
          <Tool title={t('rotateLeft')} disabled={!canView} onClick={() => setRotation((r) => (r + 270) % 360)}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 4v5h5" {...s} /><path d="M4.5 9A8 8 0 1 1 4 13" {...s} /></svg>
          </Tool>
          <Tool title={t('rotateRight')} disabled={!canView} onClick={() => setRotation((r) => (r + 90) % 360)}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 4v5h-5" {...s} /><path d="M19.5 9A8 8 0 1 0 20 13" {...s} /></svg>
          </Tool>
          <Tool title={t('zoomIn')} disabled={!canView || zoom >= 3} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
            <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="7" {...s} /><path d="M20 20l-4-4M8 11h6M11 8v6" {...s} /></svg>
          </Tool>
          <Tool title={t('zoomOut')} disabled={!canView || zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
            <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="7" {...s} /><path d="M20 20l-4-4M8 11h6" {...s} /></svg>
          </Tool>
          {canView && <span className="fv-zoom">{Math.round(zoom * 100)}%</span>}
        </div>
        <div className="fv-group">
          <Tool title={t('print')} disabled={!canView || state !== 'ready'} onClick={print}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" {...s} /><path d="M7 14h10v7H7z" {...s} /></svg>
          </Tool>
          <a className="fv-tool" title={t('download')} aria-label={t('download')} href={att.url + '?download=1'} download>
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...s} /></svg>
          </a>
          <Tool title={full ? t('exitFullscreen') : t('fullscreen')} onClick={toggleFull}>
            {full ? (
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" {...s} /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...s} /></svg>
            )}
          </Tool>
        </div>
      </div>

      <div className="fv-stage" ref={stage}>
        {state === 'loading' && <div className="fv-msg">{t('loading')}</div>}
        {state === 'error' && <div className="fv-msg">{t('previewError')}</div>}
        {state === 'unsupported' && (
          <div className="fv-msg">
            <p>{t('previewUnsupported')}</p>
            <a className="btn primary" href={att.url + '?download=1'} download>{t('download')}</a>
          </div>
        )}
        {type === 'pdf' && (
          <canvas ref={canvas} className="fv-page" style={{ display: state === 'ready' ? 'block' : 'none' }} />
        )}
        {type === 'docx' && (
          <div className="fv-docx" style={{ display: state === 'ready' ? 'block' : 'none' }}>
            <div ref={docxStyle} />
            <div ref={docxBody} style={{ transform: docxTransform, transformOrigin: 'top center' }} />
          </div>
        )}
      </div>

      {type === 'pdf' && (
        <div className="fv-pager">
          <button type="button" className="fv-tool" disabled={page <= 1} onClick={() => goPage(page - 1)} aria-label={t('prevPage')}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 6l-6 6 6 6" {...s} /></svg>
          </button>
          <input
            className="fv-page-input"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onBlur={() => goPage(Number(pageInput) || 1)}
            onKeyDown={(e) => e.key === 'Enter' && goPage(Number(pageInput) || 1)}
          />
          <span className="muted small">{t('pageOf')} {pages}</span>
          <button type="button" className="fv-tool" disabled={page >= pages} onClick={() => goPage(page + 1)} aria-label={t('nextPage')}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" {...s} /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
