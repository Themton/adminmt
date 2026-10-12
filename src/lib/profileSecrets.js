// รหัสผ่านพนักงานเก็บแยกในตาราง mt_profile_secrets (ดูได้เฉพาะหัวหน้า/แอดมิน)
// ใช้ mergeSecrets() เติม password_text กลับเข้า profiles ก่อน setProfiles
import { supabase } from './supabase'

export async function mergeSecrets(profiles) {
  const list = profiles || []
  try {
    const { data, error } = await supabase.from('mt_profile_secrets').select('id, password_text')
    if (error || !data) return list
    const m = Object.fromEntries(data.map(s => [s.id, s.password_text]))
    return list.map(p => ({ ...p, password_text: m[p.id] || p.password_text || '' }))
  } catch { return list }
}
