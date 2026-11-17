import type { CSSProperties, ReactNode } from 'react'
import '../../app/(marketing)/marketing.css'
import MarketingMotion from './MarketingMotion'
import { editorialFont } from '@/lib/marketing/editorial-font'

/** Both the root landing and grouped marketing routes share the same scope. */
export default function MarketingFrame({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className={`marketing-site platform-light min-h-screen no-text-cursor ${editorialFont.variable}`} style={style}><MarketingMotion>{children}</MarketingMotion></div>
}
