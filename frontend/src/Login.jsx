import { useState } from 'react'
import { api } from './api.js'
import { LANGS } from './i18n.js'

const DEMO = [
  ['chairman', 'roleChairmanAdmin'],
  ['deputy', 'roleDeputyAdmin'],
  ['udo', 'roleUdo'],
  ['executor1', 'roleExecutor'],
  ['executor2', 'roleExecutor'],
  ['executor3', 'roleExecutor'],
]

export default function Login({ t, lang, setLang, onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { user } = await api('/auth/login/', { method: 'POST', json: { username, password } })
      onLogin(user)
    } catch (ex) {
      setError(ex.status === 400 ? t('badLogin') : t('loadError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <svg viewBox="0 0 32 24" width="40" height="30">
            <path d="M8 22a7 7 0 0 1-.6-14A9 9 0 0 1 25 8.5 6.8 6.8 0 0 1 24.5 22z" fill="#2563eb" />
            <path d="M13 10h4l3 3v6h-7z" fill="#fff" />
          </svg>
          {t('appName')}
        </div>
        <h1>{t('loginTitle')}</h1>

        <label className="field">
          <span>{t('username')}</span>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label className="field">
          <span>{t('password')}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>

        {error && <div className="alert">{error}</div>}

        <button className="btn primary wide" disabled={busy || !username || !password}>{t('signIn')}</button>

        <div className="login-langs">
          {LANGS.map((l) => (
            <button type="button" key={l.id} className={lang === l.id ? 'active' : ''} onClick={() => setLang(l.id)}>{l.title}</button>
          ))}
        </div>

        <div className="demo">
          <div className="demo-title">{t('demoAccounts')}</div>
          {DEMO.map(([u, role]) => (
            <button type="button" key={u} className="demo-row" onClick={() => { setUsername(u); setPassword('1234') }}>
              <code>{u}</code> <span>{t(role)}</span>
            </button>
          ))}
          <div className="demo-hint">{t('demoPassword')}: <code>1234</code></div>
        </div>
      </form>
    </div>
  )
}
