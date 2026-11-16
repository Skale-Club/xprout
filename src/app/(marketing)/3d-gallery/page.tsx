import type { Metadata } from 'next'
import { gallerySections } from '@/lib/marketing/3d-gallery'
import GalleryClient from './GalleryClient'

/*
 * An internal sales tool, opened on our own phone or tablet at a restaurant:
 * never in search results, never linked from the site.
 */
export const metadata: Metadata = {
  title: { absolute: '3D Gallery — Xprout' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default function GalleryPage() {
  return <GalleryClient sections={gallerySections()} />
}
