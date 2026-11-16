import type { PageSection } from './sections'

export type LocalPageTemplate = 'locations' | 'catering' | 'private-events' | 'faq'
export interface LocalTemplateFacts {
  restaurantName: string
  description?: string
  contactEmail?: string
  questions?: { question: string; answer: string }[]
}

/** Reuses the six existing section types; never invents services, capacity, parking or review claims. */
export function localPageTemplate(kind: LocalPageTemplate, facts: LocalTemplateFacts): { title: string; sections: PageSection[] } {
  if (kind === 'locations') return { title: 'Locations and hours', sections: [{ id: 'local-locations', type: 'locations', heading: `${facts.restaurantName}: locations and hours` }] }
  if (kind === 'faq') return { title: 'Questions and answers', sections: [{ id: 'local-faq', type: 'faq', heading: 'Questions and answers', items: (facts.questions ?? []).slice(0, 30) }] }
  const title = kind === 'catering' ? 'Catering' : 'Private events'
  const sections: PageSection[] = []
  if (facts.description?.trim()) sections.push({ id: 'local-introduction', type: 'text_image', heading: title, body: facts.description.trim(), imageSide: 'right' })
  sections.push({ id: 'local-contact', type: 'contact_form', heading: `Contact ${facts.restaurantName}`,
    ...(facts.contactEmail ? { notifyEmail: facts.contactEmail } : {}) })
  return { title, sections }
}
