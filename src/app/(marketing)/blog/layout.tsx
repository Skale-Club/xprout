import { Footer, Nav } from '@/components/marketing/MarketingChrome'
import { getMarketingChrome } from '@/lib/marketing/marketing-chrome'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getMarketingChrome()
  return <><Nav appName={chrome.appName} logoUrl={chrome.logoUrl} startHref="/?signin=1" />{children}<Footer data={chrome.footerData} appName={chrome.appName} logoUrl={chrome.logoUrl} /></>
}
