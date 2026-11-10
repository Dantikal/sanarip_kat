import { useState } from 'react'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

const CHECKS = [
  { id: 'control', key: 'chkControl' },
  { id: 'nocontrol', key: 'chkNoControl' },
  { id: 'info', key: 'chkInfo' },
  { id: 'answers', key: 'chkAnswers' },
  { id: 'orders', key: 'chkOrders' },
  { id: 'npa', key: 'chkNpa' },
  { id: 'plan', key: 'chkPlan' },
]

const STATUSES = ['stAll', 'stInWork', 'stDone', 'stOverdue', 'stApproval']
const SENDERS = ['snLeaders', 'snOffice', 'snHr', 'snLegal']
const NPA = ['npaAll', 'npaLaw', 'npaResolution', 'npaDirective', 'npaOrder']

const EMPTY = {
  regFrom: '', regTo: '', deadline: '',
  number: '', exact: false, text: '',
  type: '', from: '', status: 'stAll',
  npaContains: false, npa: 'npaAll',
  checks: {},
}

export default function Filters({ t, types, onSearch }) {
  const [f, setF] = useState(EMPTY)
  const [collapsed, setCollapsed] = useState(false)
  const set = (key) => (e) => setF({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const toggleCheck = (id) => setF({ ...f, checks: { ...f.checks, [id]: !f.checks[id] } })

  const reset = () => {
    setF(EMPTY)
    onSearch?.(EMPTY)
  }

  return (
    <form className="filters" onSubmit={(e) => { e.preventDefault(); onSearch?.(f) }}>
      {!collapsed && (
        <>
          <div className="f-row f-row-1">
            <label className="field">
              <span>{t('regDate')}</span>
              <div className="range">
                <input type="date" value={f.regFrom} onChange={set('regFrom')} aria-label={t('from_')} />
                <span className="dash">—</span>
                <input type="date" value={f.regTo} onChange={set('regTo')} aria-label={t('to_')} />
              </div>
            </label>

            <label className="field">
              <span>{t('deadline')}</span>
              <input type="date" value={f.deadline} onChange={set('deadline')} />
            </label>

            <div className="field">
              <span>{t('searchNumber')}</span>
              <div className="group">
                <label className="addon">
                  <input type="checkbox" checked={f.exact} onChange={set('exact')} />
                  {t('exact')}
                </label>
                <input type="text" value={f.number} onChange={set('number')} />
              </div>
            </div>

            <label className="field">
              <span>{t('searchText')}</span>
              <input type="text" value={f.text} onChange={set('text')} />
            </label>
          </div>

          <div className="f-row f-row-2">
            <label className="field">
              <span>{t('docType')}</span>
              <select value={f.type} onChange={set('type')} className={f.type ? '' : 'placeholder'}>
                <option value="">{t('choose')}</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>

            <label className="field">
              <span>{t('sender')}</span>
              <select value={f.from} onChange={set('from')} className={f.from ? '' : 'placeholder'}>
                <option value="">{t('choose')}</option>
                {SENDERS.map((x) => <option key={x} value={x}>{t(x)}</option>)}
              </select>
            </label>

            <label className="field">
              <span>{t('status')}</span>
              <select value={f.status} onChange={set('status')} className="strong">
                {STATUSES.map((x) => <option key={x} value={x}>{t(x)}</option>)}
              </select>
            </label>

            <div className="field">
              <span>{t('npaProjects')}</span>
              <div className="group">
                <label className="addon">
                  <input type="checkbox" checked={f.npaContains} onChange={set('npaContains')} />
                  {t('contains')}
                </label>
                <select value={f.npa} onChange={set('npa')} disabled={!f.npaContains}>
                  {NPA.map((x) => <option key={x} value={x}>{t(x)}</option>)}
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="f-bottom">
        <div className="checks">
          {CHECKS.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={!!f.checks[c.id]} onChange={() => toggleCheck(c.id)} />
              {t(c.key)}
            </label>
          ))}
        </div>

        <div className="f-actions">
          <button type="submit" className="f-btn primary" title={t('find')}>
            <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="7" {...s} /><path d="M20 20l-4-4" {...s} /></svg>
          </button>
          <button type="button" className="f-btn" title={collapsed ? t('expand') : t('collapse')} onClick={() => setCollapsed(!collapsed)}>
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M6 15l6-6 6 6" {...s} />
            </svg>
          </button>
          <button type="button" className="f-btn" title={t('filterSettings')}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...s} /><circle cx="16" cy="7" r="2" {...s} /><circle cx="10" cy="17" r="2" {...s} /></svg>
          </button>
          <button type="button" className="f-btn danger" title={t('reset')} onClick={reset}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>
          </button>
        </div>
      </div>
    </form>
  )
}
