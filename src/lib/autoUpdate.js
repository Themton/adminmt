// New code is loaded only when there is no unfinished input or active operation.
export function createUpdateController({ currentVersion, fetchVersion, safeToReload, reload, notify = () => {}, now = Date.now, storage }) {
  let checking = false
  let pending = null
  let reloading = false
  return async function check() {
    if (checking || reloading) return
    checking = true
    try {
      const version = await fetchVersion()
      if (!version || version === currentVersion) { pending = null; notify(false); return }
      pending = version
      notify(true)
      if (!safeToReload()) return
      // Avoid reload loops while a CDN edge is still serving the previous build.
      let previous
      try { previous = JSON.parse(storage?.getItem('adminmt-update-attempt') || 'null') } catch {}
      if (previous?.version === pending && now() - previous.at < 300000) return
      try { storage?.setItem('adminmt-update-attempt', JSON.stringify({ version: pending, at: now() })) } catch {}
      reloading = true
      reload()
    } catch {
      // Offline, transient failures and incomplete deployments leave the page usable.
    } finally { checking = false }
  }
}

export function createInputGuard(doc, now = Date.now) {
  const originals = new Map()
  let lastInteraction = now()
  const editable = el => el?.matches?.('input, textarea, select, [contenteditable="true"]')
  const value = el => el.type === 'checkbox' || el.type === 'radio' ? String(el.checked)
    : el.type === 'file' ? String(el.files?.length || 0)
    : el.isContentEditable ? el.textContent : el.value
  const focus = event => {
    if (editable(event.target) && !originals.has(event.target)) originals.set(event.target, value(event.target))
  }
  const input = event => {
    lastInteraction = now()
    if (editable(event.target) && !originals.has(event.target)) originals.set(event.target, Symbol('changed'))
  }
  const activity = () => { lastInteraction = now() }
  for (const name of ['focusin', 'beforeinput']) doc.addEventListener(name, focus, true)
  for (const name of ['input', 'change']) doc.addEventListener(name, input, true)
  for (const name of ['pointerdown', 'keydown', 'submit']) doc.addEventListener(name, activity, true)
  return {
    safe(idleMs = 15000) {
      if (doc.visibilityState !== 'visible' || now() - lastInteraction < idleMs) return false
      for (const [el, original] of originals) {
        if (!el.isConnected) { originals.delete(el); continue }
        const current = value(el)
        if (current !== original) return false
      }
      if (doc.querySelector('[aria-busy="true"], [role="dialog"], dialog[open]')) return false
      return !Array.from(doc.querySelectorAll('button:disabled')).some(el => /กำลัง|บันทึก|อัปโหลด|อัพโหลด|saving|uploading|processing/i.test(el.textContent || ''))
    },
    dispose() {
      for (const name of ['focusin', 'beforeinput']) doc.removeEventListener(name, focus, true)
      for (const name of ['input', 'change']) doc.removeEventListener(name, input, true)
      for (const name of ['pointerdown', 'keydown', 'submit']) doc.removeEventListener(name, activity, true)
      originals.clear()
    },
  }
}

export function startAutoUpdate({ currentVersion, versionUrl, intervalMs = 30000, idleMs = 15000, win = window, doc = document } = {}) {
  const guard = createInputGuard(doc)
  let notice
  let stopped = false
  const notify = pending => {
    if (!pending) { notice?.remove(); notice = null; return }
    if (notice || stopped) return
    notice = doc.createElement('div')
    notice.setAttribute('role', 'status')
    notice.textContent = 'มีเวอร์ชันใหม่ ระบบจะอัปเดตให้อัตโนมัติเมื่อบันทึกงานเสร็จ'
    notice.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:99999;padding:10px 16px;border-radius:10px;background:#173d32;color:white;font:14px sans-serif;text-align:center;pointer-events:none'
    doc.body.appendChild(notice)
  }
  const check = createUpdateController({
    currentVersion,
    fetchVersion: async () => {
      const url = new URL(versionUrl, win.location.href)
      url.searchParams.set('_', Date.now())
      const response = await win.fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) return null
      const data = await response.json()
      return typeof data.version === 'string' && data.version.length <= 100 ? data.version : null
    },
    safeToReload: () => !stopped && guard.safe(idleMs),
    reload: () => win.location.reload(),
    notify,
    storage: { getItem: key => win.sessionStorage.getItem(key), setItem: (key, val) => win.sessionStorage.setItem(key, val) },
  })
  const onVisible = () => { if (doc.visibilityState === 'visible') void check() }
  win.addEventListener('online', onVisible)
  doc.addEventListener('visibilitychange', onVisible)
  const timer = win.setInterval(onVisible, intervalMs)
  const first = win.setTimeout(onVisible, idleMs + 1000)
  return () => {
    stopped = true
    win.clearInterval(timer); win.clearTimeout(first)
    win.removeEventListener('online', onVisible)
    doc.removeEventListener('visibilitychange', onVisible)
    guard.dispose(); notice?.remove()
  }
}
