import { describe, expect, it } from 'vitest'
import { isValidElement } from 'react'
import { renderChatText } from '@/components/menu/chat-text'

function strong(node: unknown): string | null {
  return isValidElement(node) && node.type === 'strong'
    ? String((node.props as { children: unknown }).children)
    : null
}

describe('renderChatText', () => {
  it('turns **text** into strong nodes', () => {
    const nodes = renderChatText('Try the **Premium Picanha** today')
    expect(nodes).toHaveLength(3)
    expect(nodes[0]).toBe('Try the ')
    expect(strong(nodes[1])).toBe('Premium Picanha')
    expect(nodes[2]).toBe(' today')
  })

  it('leaves an unclosed ** untouched', () => {
    expect(renderChatText('Try the **Premium')).toEqual(['Try the **Premium'])
  })

  it('drops leading heading markers', () => {
    expect(renderChatText('## Menu\n# Starters\nHello')).toEqual(['Menu\nStarters\nHello'])
  })

  it('keeps plain text and bullets unchanged', () => {
    const t = '• Fries\n• Salad #1 is nice'
    expect(renderChatText(t)).toEqual([t])
  })
})
