/**
 * Website page sections: exactly six types, validated with zod on every write
 * and again before rendering (a stored section that no longer validates is
 * skipped, never rendered half-broken). Page text is plain text: it is always
 * rendered escaped, never as HTML. External links are https only and nothing
 * is embedded (no iframes).
 */
import { z } from 'zod'
import { normalizeActionUrl } from '../menu-action-links'

export const SECTION_TYPES = ['text_image', 'cards', 'faq', 'locations', 'contact_form', 'button_link'] as const
export type SectionType = (typeof SECTION_TYPES)[number]
export const MAX_SECTIONS_PER_PAGE = 40

export const SECTION_LABELS: Record<SectionType, string> = {
  text_image: 'Text and image',
  cards: 'Cards (team, partners, testimonials)',
  faq: 'Questions and answers',
  locations: 'Locations and hours',
  contact_form: 'Contact form',
  button_link: 'Button link',
}

/** Trimmed text; an empty string counts as "not set". */
const optionalText = (max: number) => z.preprocess(
  value => (typeof value === 'string' ? (value.trim() === '' ? undefined : value.trim()) : value),
  z.string().max(max).optional(),
)
const requiredText = (max: number) => z.string().trim().min(1).max(max)

/** An absolute https URL of at most 500 characters (the same rule as the menu action links). */
const httpsUrl = z.string().trim().superRefine((value, ctx) => {
  const checked = normalizeActionUrl(value)
  if (!checked.ok || checked.value === null) ctx.addIssue({ code: 'custom', message: 'Use a full https:// link' })
})
const optionalUrl = z.preprocess(value => (typeof value === 'string' && value.trim() === '' ? undefined : value), httpsUrl.optional())

const base = { id: z.string().trim().min(1).max(40) }

export const textImageSchema = z.object({
  ...base,
  type: z.literal('text_image'),
  heading: optionalText(120),
  body: requiredText(5000),
  image: optionalUrl,
  imageSide: z.enum(['left', 'right']).default('right'),
})

export const cardsSchema = z.object({
  ...base,
  type: z.literal('cards'),
  heading: optionalText(120),
  items: z.array(z.object({
    image: optionalUrl,
    title: requiredText(120),
    subtitle: optionalText(160),
    text: optionalText(600),
  })).max(24),
})

export const faqSchema = z.object({
  ...base,
  type: z.literal('faq'),
  heading: optionalText(120),
  items: z.array(z.object({ question: requiredText(200), answer: requiredText(2000) })).max(30),
})

export const locationsSchema = z.object({ ...base, type: z.literal('locations'), heading: optionalText(120) })

export const contactFormSchema = z.object({
  ...base,
  type: z.literal('contact_form'),
  heading: optionalText(120),
  intro: optionalText(600),
  /** Where submissions are emailed; they are always listed in the admin too. */
  notifyEmail: z.preprocess(value => (typeof value === 'string' && value.trim() === '' ? undefined : value), z.string().trim().max(254).email().optional()),
})

export const buttonLinkSchema = z.object({
  ...base,
  type: z.literal('button_link'),
  heading: optionalText(120),
  text: optionalText(600),
  label: requiredText(60),
  url: httpsUrl,
})

export const sectionSchema = z.discriminatedUnion('type', [textImageSchema, cardsSchema, faqSchema, locationsSchema, contactFormSchema, buttonLinkSchema])
export type PageSection = z.infer<typeof sectionSchema>
export type TextImageSection = z.infer<typeof textImageSchema>
export type CardsSection = z.infer<typeof cardsSchema>
export type FaqSection = z.infer<typeof faqSchema>
export type ButtonLinkSection = z.infer<typeof buttonLinkSchema>

export const sectionsSchema = z.array(sectionSchema).max(MAX_SECTIONS_PER_PAGE)

/** Admin writes: every section must be valid, otherwise the whole save is refused. */
export function parseSectionsForWrite(input: unknown): { ok: true; value: PageSection[] } | { ok: false; error: string } {
  const parsed = sectionsSchema.safeParse(input)
  if (parsed.success) {
    const ids = new Set(parsed.data.map(section => section.id))
    if (ids.size !== parsed.data.length) return { ok: false, error: 'Section ids must be unique' }
    return { ok: true, value: parsed.data }
  }
  const issue = parsed.error.issues[0]
  const [index, ...field] = issue?.path ?? []
  if (typeof index === 'number') {
    const where = field.length ? ` in "${field.join(' > ')}"` : ''
    return { ok: false, error: `Section ${index + 1} has a problem${where}: ${issue?.message ?? 'invalid'}` }
  }
  return { ok: false, error: issue?.message ?? 'Invalid sections' }
}

/** Rendering: keeps the valid sections, drops anything unknown or invalid. */
export function parseSectionsForRender(input: unknown): PageSection[] {
  if (!Array.isArray(input)) return []
  const sections: PageSection[] = []
  for (const raw of input.slice(0, MAX_SECTIONS_PER_PAGE)) {
    const parsed = sectionSchema.safeParse(raw)
    if (parsed.success) sections.push(parsed.data)
  }
  return sections
}

/** Paragraphs of a plain text body: blank lines separate them. */
export function splitParagraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
}

let counter = 0
export function newSectionId(): string {
  counter += 1
  return `s${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** An empty section of a type, to start editing from. */
export function blankSection(type: SectionType): PageSection {
  const id = newSectionId()
  switch (type) {
    case 'text_image': return { id, type, body: '', imageSide: 'right' }
    case 'cards': return { id, type, items: [] }
    case 'faq': return { id, type, items: [] }
    case 'locations': return { id, type }
    case 'contact_form': return { id, type }
    case 'button_link': return { id, type, label: '', url: '' }
  }
}
