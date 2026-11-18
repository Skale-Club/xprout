import { ArrowUpRight } from 'lucide-react'
import { getDishPageCopy } from './dish-page-copy'

/**
 * The dish window's way to the dish's own page (owner, 2026-11-17: "um botão bem sutil", then
 * "só a flechinha na frente do nome"): a small grey arrow right after the dish name, no text;
 * the words are its accessible name and tooltip. Same tab, so the order (kept per restaurant and
 * menu) is still there. Nothing without a page URL.
 */
export default function DishPageLink({ href, lang }: { href?: string | null; lang: string }) {
  if (!href) return null
  const label = getDishPageCopy(lang).openDishPage
  return (
    <a href={href} data-dish-page-link aria-label={label} title={label}
      className="-my-2 ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full align-middle text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
      <ArrowUpRight className="size-5" strokeWidth={2.25} aria-hidden="true" />
    </a>
  )
}
