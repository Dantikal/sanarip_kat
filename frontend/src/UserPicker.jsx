import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

export default function UserPicker({ t, role, admin, exclude = [], placeholder, onSelect }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams({ q })
    if (role) params.set('role', role)
    if (admin) params.set('admin', '1')
    const timer = setTimeout(() => {
      api('/users/?' + params).then(setResults).catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(timer)
  }, [q, open, role, admin])

  useEffect(() => {
    const onDown = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const list = results.filter((u) => !exclude.includes(u.id))

  return (
    <div className="picker" ref={wrap}>
      <input
        type="text"
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="picker-list">
          {list.length === 0 && <div className="picker-empty">{t('nothingFound')}</div>}
          {list.map((u) => (
            <button
              type="button"
              key={u.id}
              className="picker-item"
              onClick={() => { onSelect(u); setQ(''); setOpen(false) }}
            >
              <span className="avatar sm">{initials(u.full_name)}</span>
              <span className="picker-text">
                <span className="picker-name">{u.full_name}</span>
                <span className="picker-sub">{u.position} · {u.department}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function initials(name = '') {
  return name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()
}

export function UserChip({ user, onRemove, badge }) {
  return (
    <div className="user-chip">
      <span className="avatar sm">{initials(user.full_name)}</span>
      <span className="picker-text">
        <span className="picker-name">{user.full_name}</span>
        <span className="picker-sub">{user.position} · {user.department}</span>
      </span>
      {badge && <span className="pill">{badge}</span>}
      {onRemove && (
        <button type="button" className="chip-x" onClick={onRemove} aria-label="×">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  )
}
