import { useState, useEffect, lazy, Suspense, Component } from 'react'
import { supabase } from './lib/supabase'
import { GlobalStyles, T } from './components/ui'
import LoginPage from './components/LoginPage'

const ManagerApp = lazy(() => import('./components/ManagerApp'))
const EmployeeApp = lazy(() => import('./components/EmployeeApp'))
const PackerApp = lazy(() => import('./components/PackerApp'))
const ExportApp = lazy(() => import('./components/ExportApp'))

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, color: T.text }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>เกิดข้อผิดพลาด</div>
            <pre style={{ fontSize: 12, color: T.danger, marginBottom: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-all', textAlign: 'left', background: T.surfaceAlt, padding: 12, borderRadius: 8 }}>{String(this.state.error?.message || this.state.error)}</pre>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: T.grad1, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🔄 โหลดใหม่</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  // 3 สถานะ: loading → login → ready
  const [status, setStatus] = useState('loading')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let active = true

    const fetchProfile = async (uid) => {
      const { data, error } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').eq('id', uid).single()
      if (data) return { profile: data }
      if (error && error.code === 'PGRST116') return { missing: true }   // ไม่มีโปรไฟล์จริงๆ
      throw error || new Error('profile fetch failed')
    }

    const restore = async () => {
      let session = null
      try { session = (await supabase.auth.getSession()).data.session } catch (e) {}
      if (!active) return
      if (!session?.user) { setStatus('login'); return }
      // session ยังอยู่ → โหลดโปรไฟล์ ลองซ้ำถ้าเน็ตมือถือสะดุด (ไม่เด้งออกทันทีเหมือนเดิม)
      for (let i = 0; i < 5 && active; i++) {
        try {
          const res = await fetchProfile(session.user.id)
          if (!active) return
          if (res.missing) { await supabase.auth.signOut(); setStatus('login'); return }
          setProfile(res.profile); setStatus('ready'); return
        } catch (e) {
          console.error('Profile fetch error (retry ' + (i + 1) + '):', e)
          if (i < 4) await new Promise(r => setTimeout(r, 1000 * (i + 1)))   // backoff 1-4s
        }
      }
      if (active) setStatus('login')
    }
    restore()

    // sync เมื่อ session เปลี่ยน (เช่น token refresh สำเร็จ/ล้มเหลว)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === 'SIGNED_OUT') { setProfile(null); setStatus('login') }
    })
    return () => { active = false; sub?.subscription?.unsubscribe() }
  }, [])

  async function handleLogin(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return error.message
      const { data: prof, error: profErr } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').eq('id', data.user.id).single()
      if (profErr || !prof) { await supabase.auth.signOut(); return 'ไม่พบโปรไฟล์ — ติดต่อหัวหน้า' }
      setProfile(prof)
      setStatus('ready')
      return null
    } catch (e) { return e.message || 'เกิดข้อผิดพลาด' }
  }

  function handleLogout() {
    setProfile(null)
    setStatus('login')
    supabase.auth.signOut()
  }

  if (status === 'loading') return <><GlobalStyles /><Splash text="กำลังโหลด..." /></>
  if (status === 'login' || !profile) return <><GlobalStyles /><LoginPage onLogin={handleLogin} /></>

  return (
    <ErrorBoundary>
      <GlobalStyles />
      <Suspense fallback={<Splash text="กำลังเปิด..." />}>
        {(profile.role === 'manager' || profile.role === 'admin')
          ? <ManagerApp profile={profile} onLogout={handleLogout} />
          : (profile.role === 'packer' || profile.role === 'head')
          ? <PackerApp profile={profile} onLogout={handleLogout} />
          : profile.role === 'export'
          ? <ExportApp profile={profile} onLogout={handleLogout} />
          : <EmployeeApp profile={profile} onLogout={handleLogout} />}
      </Suspense>
    </ErrorBoundary>
  )
}

function Splash({ text }) {
  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px', background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, animation: 'livePulse 1.5s infinite' }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{text || 'ADMIN THE MT'}</div>
      </div>
    </div>
  )
}
