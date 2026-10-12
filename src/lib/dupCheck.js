// ════════════════════════════════════════════════════════════
//  เช็คออเดอร์ซ้ำ — ใช้ร่วมกันทุกหน้า (พนักงาน / แอดมิน / หัวหน้า)
//  กฎ: เบอร์เดียวกัน + เพจเดียวกัน ภายใน 3 วัน
//  ฐานข้อมูลมี trigger กันซ้ำอีกชั้น (supabase-v10-migration.sql)
// ════════════════════════════════════════════════════════════
import { supabase } from './supabase'

// เบอร์: เหลือแต่ตัวเลข (ตัดขีด ช่องว่าง อักขระล่องหน)
export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '')
}

// ชื่อเพจ: ตัดอักขระล่องหน + ตัดช่องว่างหัวท้าย + ยุบช่องว่างซ้ำ
export function normalizePage(page) {
  return String(page || '')
    .replace(/[​-‍﻿ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// คีย์สำหรับเทียบ (ไม่สนช่องว่าง / ตัวพิมพ์ใหญ่เล็ก)
const pageKey = (page) => normalizePage(page).replace(/\s/g, '').toLowerCase()

/**
 * คืนค่า { error } ถ้าเช็คไม่สำเร็จ (ห้ามบันทึกต่อ)
 *       { dup } ถ้าเจอออเดอร์ซ้ำ
 *       {} ถ้าไม่ซ้ำ
 */
export async function findDuplicateOrder(phone, page) {
  const p = normalizePhone(phone)
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  // ดึงเบอร์ที่ "ลงท้าย" ด้วย 9 หลักเดียวกัน เพื่อจับเบอร์เก่าที่เก็บไว้มีขีด/ช่องว่างด้วย
  const tail = p.slice(-9)
  const { data, error } = await supabase.from('mt_orders')
    .select('id, customer_name, customer_phone, sales_channel, created_at')
    .ilike('customer_phone', `%${tail.split('').join('%')}%`)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (error) return { error }
  const key = pageKey(page)
  const dup = (data || []).find(o => normalizePhone(o.customer_phone) === p && pageKey(o.sales_channel) === key)
  return dup ? { dup } : {}
}

export function fmtDupDate(d) {
  return new Date(d).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
