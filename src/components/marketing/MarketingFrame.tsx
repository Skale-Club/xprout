import type { CSSProperties, ReactNode } from 'react'
import localFont from 'next/font/local'
import '../../app/(marketing)/marketing.css'
import MarketingMotion from './MarketingMotion'

const editorial = localFont({
  src: '../../../public/fonts/marketing/fraunces-semibold-latin.woff2',
  variable: '--font-marketing-display', weight: '600', style: 'normal',
  display: 'swap', fallback: ['Georgia', 'serif'],
})

/** Both the root landing and grouped marketing routes share the same scope. */
export default function MarketingFrame({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className={`marketing-site platform-light min-h-screen no-text-cursor ${editorial.variable}`} style={style}><MarketingMotion>{children}</MarketingMotion></div>
}
