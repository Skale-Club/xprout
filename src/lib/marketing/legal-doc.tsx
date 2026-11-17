/**
 * Renderer for superadmin-authored legal copy (/terms, /privacy).
 *
 * Returns React nodes, never HTML. There is no `dangerouslySetInnerHTML` on
 * this path, so authored copy cannot inject markup or script and the read path
 * needs no sanitizer dependency. Anything the grammar does not recognise is
 * emitted as plain text.
 *
 * Supported subset (enough for a legal document, deliberately no more):
 *   ## Heading            -> h2
 *   ### Heading           -> h3
 *   - item                -> ul/li
 *   1. item               -> ol/li
 *   blank-line separated  -> p
 *   **bold**              -> strong
 *   [label](url)          -> a, restricted to http/https/mailto
 *
 * Single newlines inside a paragraph are treated as soft wraps (joined with a
 * space), matching how people paste text out of a word processor.
 */
import type { ReactNode } from 'react'

export interface LegalDoc {
  title?: string
  body?: string
  updated_at?: string
}

/** Only these schemes may become an href. Blocks javascript:/data: entirely. */
const SAFE_HREF = /^(https?:\/\/|mailto:)/i

/** Splits a line into bold / link / text tokens without consuming the rest. */
const INLINE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0

  for (const match of text.matchAll(INLINE)) {
    const token = match[0]
    const start = match.index

    if (start > last) out.push(text.slice(last, start))

    if (token.startsWith('**')) {
      out.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>)
    } else {
      const split = token.indexOf('](')
      const label = token.slice(1, split)
      const href = token.slice(split + 2, -1)

      // Unsafe scheme: keep the author's text visible, drop the link.
      if (SAFE_HREF.test(href)) {
        out.push(
          <a
            key={`${keyPrefix}-a${i}`}
            href={href}
            className="mk-legal-link"
            {...(href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
          >
            {label}
          </a>,
        )
      } else {
        out.push(label)
      }
    }

    last = start + token.length
    i++
  }

  if (last < text.length) out.push(text.slice(last))
  return out
}

/** "3. How we use information" -> number "3" and label "How we use information". */
function splitNumber(text: string): { number: string | null; label: string } {
  const match = /^(\d{1,2})[.)]\s+(.+)$/.exec(text)
  return match ? { number: match[1], label: match[2] } : { number: null, label: text }
}

/** A stable anchor for a section heading, also used by the page's table of contents. */
export function legalAnchor(text: string): string {
  const slug = text.toLowerCase().replace(/\*\*|\[|\]\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `section-${slug || 'part'}`
}

export interface LegalSection { id: string; number: string | null; label: string }

/** The `##` sections of a document, in order, for the table of contents. */
export function legalOutline(body: string): LegalSection[] {
  return body.replace(/\r\n/g, '\n').split(/\n{2,}/).map(block => block.trim())
    .filter(block => block.startsWith('## '))
    .map(block => {
      const text = block.slice(3).split('\n')[0].trim()
      const { number, label } = splitNumber(text)
      return { id: legalAnchor(text), number, label: label.replace(/\*\*/g, '') }
    })
}

/** Parses the Markdown subset into React nodes. */
export function renderLegalBody(body: string): ReactNode[] {
  // Normalise CRLF so blocks split identically regardless of where the copy
  // was pasted from.
  const blocks = body.replace(/\r\n/g, '\n').split(/\n{2,}/)
  const nodes: ReactNode[] = []

  blocks.forEach((raw, bi) => {
    const block = raw.trim()
    if (!block) return

    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

    if (block.startsWith('### ')) {
      nodes.push(
        <h3 key={`h3-${bi}`}>
          {renderInline(block.slice(4), `h3-${bi}`)}
        </h3>,
      )
      return
    }

    if (block.startsWith('## ')) {
      const heading = block.slice(3).split('\n')[0].trim()
      const { number, label } = splitNumber(heading)
      nodes.push(
        <h2 key={`h2-${bi}`} id={legalAnchor(heading)}>
          {number ? <span className="mk-legal-num" aria-hidden="true">{number.padStart(2, '0')}</span> : null}
          <span>{renderInline(label, `h2-${bi}`)}</span>
        </h2>,
      )
      return
    }

    if (lines.every(l => l.startsWith('- '))) {
      nodes.push(
        <ul key={`ul-${bi}`}>
          {lines.map((l, li) => (
            <li key={li}>{renderInline(l.slice(2), `ul-${bi}-${li}`)}</li>
          ))}
        </ul>,
      )
      return
    }

    if (lines.every(l => /^\d+\.\s/.test(l))) {
      nodes.push(
        <ol key={`ol-${bi}`}>
          {lines.map((l, li) => (
            <li key={li}>{renderInline(l.replace(/^\d+\.\s/, ''), `ol-${bi}-${li}`)}</li>
          ))}
        </ol>,
      )
      return
    }

    nodes.push(
      <p key={`p-${bi}`}>
        {renderInline(lines.join(' '), `p-${bi}`)}
      </p>,
    )
  })

  return nodes
}

/** Reads one document out of the `legal` jsonb blob, tolerating any shape. */
export function pickLegalDoc(legal: unknown, key: 'terms' | 'privacy'): LegalDoc | null {
  if (!legal || typeof legal !== 'object') return null
  const doc = (legal as Record<string, unknown>)[key]
  if (!doc || typeof doc !== 'object') return null

  const { title, body, updated_at } = doc as Record<string, unknown>
  const text = typeof body === 'string' ? body.trim() : ''
  if (!text) return null

  return {
    title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
    body: text,
    updated_at: typeof updated_at === 'string' && updated_at.trim() ? updated_at.trim() : undefined,
  }
}
