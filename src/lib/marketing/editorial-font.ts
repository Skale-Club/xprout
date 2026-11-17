import localFont from 'next/font/local'

/** The marketing title face (Fraunces semibold): the site's headings and the sign-in popup title. */
export const editorialFont = localFont({
  src: '../../../public/fonts/marketing/fraunces-semibold-latin.woff2',
  variable: '--font-marketing-display', weight: '600', style: 'normal',
  display: 'swap', fallback: ['Georgia', 'serif'],
})
