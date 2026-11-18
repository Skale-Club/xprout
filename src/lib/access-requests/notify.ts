import { BRAND_URL } from '@/lib/brand'
import 'server-only'
import { sendToAll } from '@/lib/blog/telegram'
import { getIdentityServices } from '@/lib/auth/identity-services'
import type { AbandonedDraft, SubmittedLead } from './store'

/**
 * Team notifications on Telegram. Never throws: a notification problem must not
 * affect the applicant. Uses explicitly configured shared-bot credentials and
 * dedicated Leads groups, never blog, approval or technical Ops destinations.
 */

const LABELS: Record<string, Record<string, string>> = {
  businessType: { restaurant: 'Restaurante', bar: 'Bar', cafe: 'Cafe', bakery: 'Padaria', pizzeria: 'Pizzaria', food_truck: 'Food truck', hotel: 'Hotel', other: 'Outro' },
  currentMenu: { printed: 'Impresso', pdf_qr: 'PDF / QR code', other_app: 'Outro app', none: 'Nenhum' },
  menuSize: { up_to_30: 'Ate 30 itens', '30_80': '30 a 80 itens', '80_plus': 'Mais de 80 itens' },
  contactTime: { morning: 'Manha', afternoon: 'Tarde', evening: 'Noite' },
  interests: { qr_menu: 'Cardapio QR', table_ordering: 'Pedido na mesa', takeout_delivery: 'Retirada/entrega', ai_chat: 'Chat com IA', ar_dishes: 'Pratos em AR', website_domain: 'Site/dominio', multi_language: 'Multi-idioma' },
}
const STEP_LABELS: Record<string, string> = {
  language: 'idioma', businessName: 'nome do negocio', businessType: 'tipo de negocio', location: 'localizacao', contact: 'contato',
  locations: 'unidades', currentMenu: 'cardapio atual', interests: 'interesses', menuSize: 'tamanho do cardapio', socialUrl: 'rede social', contactTime: 'horario de contato',
}

const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const label = (group: string, value: string | undefined) => (value ? LABELS[group]?.[value] ?? value : null)
const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '')
const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || ''

let warned = false
function warnOnce(message: string) {
  if (warned) return
  warned = true
  console.warn(`access_request.notify_unavailable: ${message}`)
}

/** The main Xprout origin (where /access-requests lives): the identity origin, then the app URL. */
function siteOrigin() {
  for (const candidate of [() => getIdentityServices().config.origin, () => process.env.NEXT_PUBLIC_APP_URL]) {
    try { const value = candidate(); if (value) return new URL(value).origin } catch { /* next candidate */ }
  }
  return BRAND_URL
}

function whatsappLink(phone: string | null | undefined, greeting: string) {
  const number = digits(phone)
  return number.length >= 8 ? `https://wa.me/${number}?text=${encodeURIComponent(greeting)}` : null
}

function destination(): { token: string; chatIds: string[] } | null {
  const token = process.env.ACCESS_REQUEST_TELEGRAM_BOT_TOKEN?.trim()
  const configured = process.env.ACCESS_REQUEST_TELEGRAM_CHAT_IDS?.trim()
  if (!token || !configured) return null
  const chatIds = [...new Set(configured.split(',').map(id => id.trim()))]
  const opsChat = process.env.OPS_TELEGRAM_CHAT_ID?.trim().split(':')[0]
  for (const target of chatIds) {
    const match = /^(-[1-9]\d*)(?::([1-9]\d*))?$/.exec(target)
    if (!match || match[1] === opsChat) return null
    if (match[2] && !Number.isSafeInteger(Number(match[2]))) return null
  }
  return { token, chatIds }
}

async function deliver(message: () => string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false
  try {
    const target = destination()
    if (!target) { warnOnce('dedicated Leads destination unavailable'); return false }
    return (await sendToAll(target.token, target.chatIds, message())).success
  } catch {
    console.warn('access_request.notify_failed')
    return false
  }
}

export function submittedMessage(lead: SubmittedLead): string {
  const a = lead.answers
  const business = a.businessType === 'other' && a.businessTypeOther ? `Outro (${a.businessTypeOther})` : label('businessType', a.businessType)
  const lines = ['<b>NOVO PEDIDO DE ACESSO · XPROUT</b>', '']
  const add = (name: string, value: unknown) => { if (value) lines.push(`${name}: ${esc(value)}`) }
  add('Nome', lead.name)
  add('Telefone da conta', lead.accountPhone)
  add('Telefone de contato', a.contactPhone)
  add('E-mail', a.contactEmail)
  add('Negocio', a.businessName)
  add('Tipo', business)
  add('Local', a.location)
  add('Unidades', a.locations)
  add('Cardapio atual', label('currentMenu', a.currentMenu))
  add('Interesses', a.interests?.length ? a.interests.map(i => label('interests', i)).join(', ') : null)
  add('Tamanho do cardapio', label('menuSize', a.menuSize))
  add('Rede social', a.socialUrl)
  add('Melhor horario', label('contactTime', a.contactTime))
  const wa = whatsappLink(a.contactPhone || lead.accountPhone, `Olá, ${firstName(lead.name)}! Recebemos seu cadastro no Xprout e queremos agendar uma conversa com você.`)
  lines.push('')
  if (wa) lines.push(`WhatsApp: ${esc(wa)}`)
  lines.push(`Analisar: ${siteOrigin()}/access-requests`)
  return lines.join('\n')
}

export function abandonedMessage(draft: AbandonedDraft): string {
  const lines = ['<b>CADASTRO ABANDONADO · XPROUT</b>', '']
  const add = (name: string, value: unknown) => { if (value) lines.push(`${name}: ${esc(value)}`) }
  add('Nome', draft.full_name)
  add('Telefone', draft.answers.contactPhone || draft.phone)
  add('Negocio', draft.answers.businessName)
  add('Parou em', STEP_LABELS[draft.step] ?? draft.step)
  const wa = whatsappLink(draft.answers.contactPhone || draft.phone, `Olá, ${firstName(draft.full_name)}! Vimos que você começou seu cadastro no Xprout. Posso ajudar?`)
  if (wa) lines.push('', `WhatsApp: ${esc(wa)}`)
  return lines.join('\n')
}

export const notifyAccessRequestSubmitted = (lead: SubmittedLead) => deliver(() => submittedMessage(lead))
export const notifyAbandonedDraft = (draft: AbandonedDraft) => deliver(() => abandonedMessage(draft))
