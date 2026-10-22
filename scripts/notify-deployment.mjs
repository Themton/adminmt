import { createClient } from '@supabase/supabase-js'
import { setTimeout as delay } from 'node:timers/promises'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, GITHUB_SHA: version, PAGE_URL: pageUrl } = process.env
if (!url || !key || !version || !pageUrl) throw new Error('Missing deployment notification configuration')
// Wait for this exact deployment before sending one event to all connected clients.
let ready = false
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const manifest = new URL('app-version.json', pageUrl.endsWith('/') ? pageUrl : pageUrl + '/')
    manifest.searchParams.set('release', `${version}-${attempt}`)
    const response = await fetch(manifest, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    ready = response.ok && (await response.json()).version === version
    if (ready) break
  } catch {}
  await delay(10000)
}
if (!ready) throw new Error('Deployment manifest is not ready; no update event was sent')
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const channel = client.channel('adminmt-releases')
try {
  // The SDK sends this via REST when the channel is not subscribed.
  const result = await channel.send({ type: 'broadcast', event: 'deployed', payload: { version } })
  if (result !== 'ok') throw new Error(`Deployment broadcast failed: ${result}`)
  console.log(`Deployment ${version} published; update event sent to connected clients.`)
} finally { await client.removeChannel(channel) }
