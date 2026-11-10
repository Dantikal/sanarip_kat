import { useEffect, useRef, useState } from 'react'
import { LANGS, loadLang, makeT, saveLang } from './i18n.js'
import Filters from './Filters.jsx'
import { api } from './api.js'
import Login from './Login.jsx'
import RegisterPage from './RegisterPage.jsx'
import DocumentList from './DocumentList.jsx'
import DocumentPage from './DocumentPage.jsx'
import { initials } from './UserPicker.jsx'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ICONS = {
  svodyashchiy: <><circle cx="12" cy="12" r="9" {...s} /><path d="M15 9.5a3.5 3.5 0 1 0 0 5" {...s} /></>,
  oznakomitsya: <><path d="M14 3H7a2 2 0 0 0-2 2v6M14 3l5 5v11a2 2 0 0 1-2 2h-5M14 3v5h5" {...s} /><circle cx="7" cy="17" r="3" {...s} /></>,
  izbrannye: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" {...s} />,
  'na-kontrole': <path d="M5 21V4M5 4h11l-2 4 2 4H5" {...s} />,
  soispolnitel: <><circle cx="12" cy="8" r="4" {...s} /><path d="M4 21a8 8 0 0 1 16 0" {...s} /></>,
  'moi-dokumenty': <><circle cx="10" cy="8" r="4" {...s} /><path d="M3 21a7 7 0 0 1 10-6.3M15 20l1-3 4.5-4.5a1.4 1.4 0 0 1 2 2L18 19z" {...s} /></>,
  'vhodyashchie-otvety': <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" {...s} /><path d="M3 12h11m-3-3 3 3-3 3" {...s} /></>,
  'vnutrennie-otvety': <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s} /><path d="M9 13h6m-3-3 3 3-3 3" {...s} /></>,
  chernovik: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s} /><path d="M9 17l1-3 4-4 2 2-4 4z" {...s} /></>,
  vse: <><path d="M9 7V5a2 2 0 0 1 2-2h5l4 4v10a2 2 0 0 1-2 2h-3" {...s} /><path d="M4 9a2 2 0 0 1 2-2h5l4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" {...s} /></>,
  vnutrenniy: <><path d="M14 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" {...s} /><path d="M10 6v8H4m3-3-3 3 3 3" {...s} /></>,
  vhodyashchiy: <><path d="M10 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5" {...s} /><path d="M3 10h9m-3-3 3 3-3 3" stroke="#e8a317" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
  ishodyashchiy: <><path d="M10 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5" {...s} /><path d="M13 12H4m3-3-3 3 3 3" stroke="#2563eb" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
  obrashcheniya: <><circle cx="9" cy="8" r="4" {...s} /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M18 15a6 6 0 0 1 4 6" {...s} /></>,
}

const MAIN_MENU = [
  { id: 'documents', title: 'Документы' },
  { id: 'register', title: 'Зарегистрировать' },
  { id: 'plans', title: 'Планы' },
  { id: 'summary', title: 'Сводка' },
  { id: 'act', title: 'Проект акта' },
  { id: 'employees', title: 'Сотрудники', divider: true },
  { id: 'about', title: 'О системе' },
  { id: 'archive', title: 'Архив' },
]

Object.assign(ICONS, {
  documents: ICONS.vse,
  register: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s} /><path d="M14 3v5h5M12 11v6M9 14h6" {...s} /></>,
  plans: <><circle cx="6" cy="17" r="2.5" {...s} /><circle cx="18" cy="7" r="2.5" {...s} /><path d="M8.5 17H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5" {...s} /></>,
  summary: <><rect x="4" y="4" width="7" height="7" rx="1" {...s} /><rect x="13" y="4" width="7" height="7" rx="1" {...s} /><rect x="4" y="13" width="7" height="7" rx="1" {...s} /><rect x="13" y="13" width="7" height="7" rx="1" {...s} /></>,
  act: <><path d="M7 4h12v13a3 3 0 0 1-3 3H8M7 4a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2zM7 8v9a3 3 0 0 0 3 3" {...s} /><path d="M11 9h5M11 13h5" {...s} /></>,
  employees: ICONS.obrashcheniya,
  about: <><rect x="5" y="4" width="14" height="17" rx="2" {...s} /><path d="M9 3v2M15 3v2M9 10h6M9 14h6M9 18h3" {...s} /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" {...s} /><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" {...s} /></>,
})

ICONS['na-podpis'] = <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s} /><path d="M8 17c1.5 0 2-3 3-3s.5 2 1.5 2 1-1.5 2-1.5 1 1 2 1" {...s} /></>

const TOP_TABS = ['documents', 'register', 'plans', 'summary', 'act']
function docFromHash() {
  const m = location.hash.match(/^#\/doc\/(\d+)$/)
  return m ? Number(m[1]) : null
}

const START_SECTION = { chairman: 'na-podpis', udo: 'ozhidanie-registracii', executor: 'svodyashchiy' }

ICONS['ozhidanie-registracii'] = <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M14 3l5 5v2M14 3v5h5" {...s} /><circle cx="17" cy="17" r="4" {...s} /><path d="M17 15v2l1.3 1" {...s} /></>
ICONS['zhdet-zakrytiya'] = <><rect x="3" y="4" width="18" height="5" rx="1" {...s} /><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M9 14l2 2 4-4" {...s} /></>
ICONS['na-dorabotke'] = <><path d="M12 4 2.5 20h19z" {...s} /><path d="M12 10v4M12 17v.5" {...s} /></>
ICONS['gotovo-k-arhivirovaniyu'] = <><rect x="3" y="4" width="18" height="5" rx="1" {...s} /><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" {...s} /></>
ICONS.otkazannye = <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s} /><path d="M14 3v5h5M9.5 12.5l5 5M14.5 12.5l-5 5" {...s} /></>

ICONS['na-rezolyuciyu'] = <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s} /><path d="M14 3v5h5M8 13h5M8 17h3M15 15l2 2 3-4" {...s} /></>

function Icon({ id }) {
  return <svg className="icon" viewBox="0 0 24 24" width="20" height="20">{ICONS[id]}</svg>
}

function Item({ item, active, onClick, children }) {
  return (
    <button className={'item' + (active ? ' active' : '')} onClick={onClick}>
      <Icon id={item.id} />
      <span className="item-title">{item.title}</span>
      {item.count > 0 && <span className="count">{item.count}</span>}
      {children}
    </button>
  )
}

export default function App() {
  const [auth, setAuth] = useState(undefined)
  const [menu, setMenu] = useState(null)
  const [docId, setDocId] = useState(docFromHash)
  const [docSection, setDocSection] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState('ya-sozdal')
  const [myDocsOpen, setMyDocsOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [page, setPage] = useState('documents')
  const [lang, setLang] = useState(loadLang)
  const [userOpen, setUserOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const userRef = useRef(null)
  const t = makeT(lang)

  useEffect(() => {
    document.documentElement.lang = lang
    saveLang(lang)
  }, [lang])

  useEffect(() => {
    const onDown = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false)
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    api('/auth/me/')
      .then((d) => setAuth(d.user))
      .catch(() => setError('loadError'))
  }, [])

  useEffect(() => {
    if (!auth) return
    api('/menu/')
      .then(setMenu)
      .catch((ex) => (ex.status === 401 ? setAuth(null) : setError('loadError')))
  }, [auth, reloadKey])

  const onLogin = (user) => {
    setMenu(null)
    setDocId(docFromHash())
    setPage('documents')
    setSelected(user.is_admin ? 'na-podpis' : START_SECTION[user.role] || 'vse')
    setAuth(user)
  }

  const logout = async () => {
    setUserOpen(false)
    try { await api('/auth/logout/', { method: 'POST' }) } catch { /* ignore */ }
    setAuth(null)
    setMenu(null)
  }

  const refresh = () => setReloadKey((k) => k + 1)

  // адрес страницы ↔ открытый документ (#/doc/ID), чтобы ссылкой можно было поделиться
  useEffect(() => {
    const want = docId ? `#/doc/${docId}` : ''
    if (location.hash !== want) history.pushState(null, '', want || location.pathname + location.search)
  }, [docId])

  useEffect(() => {
    const sync = () => setDocId(docFromHash())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      setUserOpen(false)
      setLangOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (error) return <div className="loading error">{t(error)}</div>
  if (auth === null) return <Login t={t} lang={lang} setLang={setLang} onLogin={onLogin} />
  if (!auth || !menu) return <div className="loading">{t('loading')}</div>

  const tr = (list) => list.map((i) => ({ ...i, title: t(i.id, i.title) }))
  const waiting = { title: t('waiting'), items: tr(menu.waiting.items) }
  const important = { title: t('important'), items: tr(menu.important.items) }
  const my_documents = {
    items: tr(menu.my_documents.items),
    types_title: t('types'),
    types: tr(menu.my_documents.types),
  }
  const mainMenu = tr(MAIN_MENU)
  const all = [...waiting.items, ...important.items, ...my_documents.items, ...my_documents.types]
  const current = page === 'documents'
    ? all.find((i) => i.id === selected)
    : page === 'profile'
      ? { title: t('profile') }
      : mainMenu.find((i) => i.id === page)

  const openPage = (id) => {
    setPage(id)
    setDocId(null)
    setMenuOpen(false)
  }
  const openSection = (id) => {
    setSelected(id)
    setPage('documents')
    setDocId(null)
  }
  const noSidebar = page === 'register' && !docId
  const waitingTotal = menu.waiting.items.reduce((n, i) => n + (i.passive ? 0 : i.count || 0), 0)
  const roleName = t({ chairman: 'roleChairman', udo: 'roleUdo', executor: 'roleExecutor' }[auth.role])

  const chooseLang = (id) => {
    setLang(id)
    setLangOpen(false)
    setUserOpen(false)
  }

  const renderItem = (item) => {
    if (item.id === 'moi-dokumenty') {
      return (
        <div key={item.id}>
          <Item item={item} onClick={() => setMyDocsOpen(!myDocsOpen)}>
            <svg className={'chevron' + (myDocsOpen ? ' open' : '')} viewBox="0 0 24 24" width="18" height="18">
              <path d="M6 15l6-6 6 6" {...s} strokeWidth="2" />
            </svg>
          </Item>
          {myDocsOpen && (
            <div className="submenu">
              {my_documents.items.map((sub) => (
                <button
                  key={sub.id}
                  className={'subitem' + (page === 'documents' && selected === sub.id ? ' active' : '')}
                  onClick={() => openSection(sub.id)}
                >
                  {sub.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }
    return <Item key={item.id} item={item} active={page === 'documents' && selected === item.id} onClick={() => openSection(item.id)} />
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="logo-row">
          <button className="burger" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('menu')}>
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 6h16M4 12h16M4 18h16" {...s} strokeWidth="2" /></svg>
          </button>
          <span className="logo">
            <svg viewBox="0 0 32 24" width="30" height="22">
              <path d="M8 22a7 7 0 0 1-.6-14A9 9 0 0 1 25 8.5 6.8 6.8 0 0 1 24.5 22z" fill="#2563eb" />
              <path d="M13 10h4l3 3v6h-7z" fill="#fff" />
            </svg>
            {t('appName')}
          </span>
        </div>

        <nav className="top-tabs">
          {TOP_TABS.map((id) => {
            const item = mainMenu.find((m) => m.id === id)
            const active = page === id
            return (
              <button
                key={id}
                className={'top-tab' + (active ? ' active' : '')}
                title={item.title}
                onClick={() => openPage(id)}
              >
                <Icon id={id} />
                {active && <span>{item.title}</span>}
              </button>
            )
          })}
        </nav>

        <div className="top-right">
          <button className="top-icon" title={t('notifications')}>
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" {...s} /></svg>
            {waitingTotal > 0 && <span className="badge">{waitingTotal}</span>}
          </button>
          <div className="user-wrap" ref={userRef}>
            <button className="user" onClick={() => { setUserOpen(!userOpen); setLangOpen(false) }} aria-expanded={userOpen}>
              <span className="avatar">{initials(auth.full_name)}</span>
              <span className="user-info">
                <span className="user-name">{auth.full_name}</span>
                <span className="user-role">{roleName} | {auth.department}</span>
              </span>
              <svg className={'user-chevron' + (userOpen ? ' open' : '')} viewBox="0 0 24 24" width="16" height="16"><path d="M6 9l6 6 6-6" {...s} strokeWidth="2" /></svg>
            </button>

            <div className={'user-menu' + (userOpen ? ' open' : '')} aria-hidden={!userOpen}>
              <button className="um-item" onClick={() => { openPage('profile'); setUserOpen(false) }}>
                <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="8" r="4" {...s} /><path d="M4 21a8 8 0 0 1 16 0" {...s} /></svg>
                {t('profile')}
              </button>

              <button className="um-item" onClick={() => setLangOpen(!langOpen)} aria-expanded={langOpen}>
                <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" {...s} /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" {...s} /></svg>
                <span className="um-grow">{t('switchLang')}</span>
                <span className="um-lang">{lang.toUpperCase()}</span>
                <svg className={'um-chevron' + (langOpen ? ' open' : '')} viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" {...s} strokeWidth="2" /></svg>
              </button>
              <div className={'um-langs' + (langOpen ? ' open' : '')}>
                <div>
                {LANGS.map((l) => (
                  <button key={l.id} className={'um-sub' + (lang === l.id ? ' active' : '')} onClick={() => chooseLang(l.id)}>
                    {l.title}
                    {lang === l.id && (
                      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12l5 5 9-10" {...s} strokeWidth="2" /></svg>
                    )}
                  </button>
                ))}
                </div>
              </div>

              <div className="um-divider" />
              <button className="um-item danger" onClick={logout}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" {...s} /></svg>
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className={'body' + (noSidebar ? ' no-sidebar' : '')}>
      {!noSidebar && (
      <aside className="sidebar">

        <nav className="nav">
          <div className="group-title">{waiting.title}</div>
          {waiting.items.map(renderItem)}

          <div className="group-title">{important.title}</div>
          {important.items.map(renderItem)}

          <div className="group-title">{my_documents.types_title}</div>
          {my_documents.types.map(renderItem)}
        </nav>
      </aside>
      )}

      <div className={'menu-backdrop' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)} />
      <nav className={'main-menu' + (menuOpen ? ' open' : '')} aria-hidden={!menuOpen}>
        <div className="menu-head">
          <span className="menu-title">{t('menu')}</span>
          <button className="menu-setup">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" {...s} strokeWidth="2" /></svg>
            {t('setup')}
          </button>
        </div>
        {mainMenu.map((item) => (
          <div key={item.id}>
            {item.divider && <div className="divider" />}
            <Item item={item} active={page === item.id} onClick={() => openPage(item.id)} />
          </div>
        ))}
      </nav>

      <main className="content">
        {docId ? (
          <DocumentPage key={docId} t={t} lang={lang} id={docId} section={docSection} onOpen={setDocId} onBack={() => setDocId(null)} onChanged={refresh} />
        ) : page === 'register' ? (
          <RegisterPage
            t={t}
            lang={lang}
            user={auth}
            onRegistered={(doc) => { setPage('documents'); setDocId(doc.id); refresh() }}
          />
        ) : page === 'documents' ? (
          <>
            <Filters key={selected} t={t} types={my_documents.types.filter((x) => x.id !== 'vse')} />
            <h1>{current?.title}</h1>
            <DocumentList t={t} lang={lang} section={selected} reloadKey={reloadKey} onOpen={(id) => { setDocSection({ id: selected, title: current?.title }); setDocId(id) }} />
          </>
        ) : page === 'archive' ? (
          <>
            <h1>{current?.title}</h1>
            <DocumentList t={t} lang={lang} section="arhiv" reloadKey={reloadKey} onOpen={(id) => { setDocSection({ id: 'arhiv', title: current?.title }); setDocId(id) }} />
          </>
        ) : page === 'profile' ? (
          <section className="card profile-card">
            <span className="avatar lg">{initials(auth.full_name)}</span>
            <div>
              <h1>{auth.full_name}</h1>
              <dl className="info one">
                <dt>{t('roleLabel')}</dt><dd>{roleName}</dd>
                <dt>{t('positionLabel')}</dt><dd>{auth.position || '—'}</dd>
                <dt>{t('departmentLabel')}</dt><dd>{auth.department || '—'}</dd>
                <dt>{t('adminLabel')}</dt><dd>{auth.is_admin ? t('adminYes') : t('adminNo')}</dd>
              </dl>
            </div>
          </section>
        ) : (
          <>
            <h1>{current?.title}</h1>
            <p className="empty">{t('empty')}</p>
          </>
        )}
      </main>
      </div>
    </div>
  )
}
