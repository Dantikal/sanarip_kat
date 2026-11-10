function csrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `HTTP ${status}`)
    this.status = status
    this.data = data || {}
  }
}

export async function api(path, { method = 'GET', json, form } = {}) {
  const headers = {}
  let bodyData
  if (method !== 'GET') headers['X-CSRFToken'] = csrfToken()
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    bodyData = JSON.stringify(json)
  } else if (form) {
    bodyData = form
  }
  const r = await fetch('/api' + path, { method, headers, body: bodyData, credentials: 'same-origin' })
  let data = null
  try { data = await r.json() } catch { /* empty body */ }
  if (!r.ok) throw new ApiError(r.status, data)
  return data
}
