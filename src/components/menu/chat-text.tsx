import type { ReactNode } from 'react'

/**
 * Turns the light Markdown some models still emit into safe React nodes:
 * **bold** becomes <strong>, leading "#" heading markers are dropped.
 * Everything else stays text. Never parses HTML. An unclosed "**" is left as is
 * (it may still be streaming).
 */
export function renderChatText(text: string): ReactNode[] {
  const cleaned = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
  const nodes: ReactNode[] = []
  const bold = /\*\*([^*\n]+?)\*\*/g
  let last = 0
  let key = 0
  let match: RegExpExecArray | null
  while ((match = bold.exec(cleaned)) !== null) {
    if (match.index > last) nodes.push(cleaned.slice(last, match.index))
    nodes.push(<strong key={key++}>{match[1]}</strong>)
    last = match.index + match[0].length
  }
  if (last < cleaned.length) nodes.push(cleaned.slice(last))
  return nodes
}
