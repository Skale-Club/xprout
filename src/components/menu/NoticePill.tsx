'use client'

/** Small "2 h notice" pill on a dish that needs advance notice (scheduled orders). */
import { noticeParts } from '@/lib/orders/scheduled-orders'
import DishFeaturePill from './DishFeaturePill'
import { fill, getMenuCopy } from './menu-i18n'

export default function NoticePill({ minutes, lang, className = '' }: { minutes: number; lang: string; className?: string }) {
  if (!(minutes > 0)) return null
  const copy = getMenuCopy(lang)
  const { unit, value } = noticeParts(minutes)
  const label = fill(unit === 'min' ? copy.noticeMin : unit === 'h' ? copy.noticeHour : copy.noticeDay, { n: value })
  return <DishFeaturePill tag={label} lang={lang} className={className} />
}
