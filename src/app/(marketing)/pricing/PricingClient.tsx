'use client'

import { useId, useState, type ReactNode } from 'react'
import { Check, Minus, ArrowRight } from 'lucide-react'
import { Nav, Footer, type FooterData } from '@/components/marketing/MarketingChrome'
import {
  ADDONS, CHANGES_PER_MONTH, LAUNCH_ENDS, LAUNCH_SLOTS, MAX_ITEMS, MAX_LANGUAGES, MIN_MONTHS, NFC_NOTE, PAYMENT_SPLIT,
  PLANS, PRICING_CTA_HREF, PROJECTS, THREE_D_TIER_10, THREE_D_TIER_20, YEARLY_FREE_MONTHS,
  estimateProject, formatUsd, type EstimateMode, type PlanKey,
} from '@/lib/marketing/pricing'

const card = 'mk-panel min-w-0 rounded-[24px] border border-[var(--mk-line)]'
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current'
const ctaBtn = 'mk-button'

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mk-eyebrow">{children}</p>
}

function SectionHead({ eyebrow, title, lead, id }: { eyebrow: string; title: string; lead?: string; id: string }) {
  return (
    <div className="mb-10 grid gap-4">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mk-h2 max-w-3xl">{title}</h2>
      {lead && <p className="mk-lead max-w-2xl">{lead}</p>}
    </div>
  )
}

/** Launch price big, list price crossed out next to it. */
function Price({ launch, list, note }: { launch: number; list: number; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <strong className="mk-price text-[clamp(2.5rem,4vw,3.5rem)] font-semibold leading-none">{formatUsd(launch)}</strong>
      <s className="mk-muted text-base tabular-nums" aria-label={`regular price ${formatUsd(list)}`}>{formatUsd(list)}</s>
      {note && <span className="mk-muted w-full pt-2 text-base">{note}</span>}
    </div>
  )
}

function Inc({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3 text-base leading-relaxed">
      {items.map((t) => (
        <li key={t} className="grid grid-cols-[18px_1fr] gap-2">
          <Check className="mt-1 h-4 w-4" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function BuildSection() {
  const we = PROJECTS.we
  const td = PROJECTS.threeD
  return (
    <section id="projects" aria-labelledby="build-title" className="mk-container mk-section scroll-mt-24">
      <SectionHead id="build-title" eyebrow="01 / Your project" title="A considered start. Made for your restaurant." lead="Choose how much you want us to take care of. Each project is a one-time price, with the first month included." />
      <div className="grid gap-5 lg:grid-cols-3">
        <article data-tier="diy" className={`${card} mk-project-card grid content-start gap-4 p-6`}>
          <h3 className="mk-eyebrow">You add the items</h3>
          <Price launch={PROJECTS.diy.launch} list={PROJECTS.diy.list} note="one-time" />
          <Inc items={[
            'Menu website with your logo and colours',
            'Categories, 2 languages, hours, contacts and map',
            'SEO pages and QR codes for your tables',
            '30-minute training by video call',
            'You add dishes and photos in your own panel',
          ]} />
          <p className="mk-muted border-t border-current/15 pt-4 text-base">Unlimited items, added by you.</p>
        </article>

        <article data-tier="complete" className="mk-project-card mk-dark grid min-w-0 content-start gap-5 rounded-[24px] p-6 sm:p-8">
          <h3 className="mk-eyebrow">Complete setup · we do everything</h3>
          <Price launch={we.launch} list={we.list} note={`one-time · up to ${we.includedItems} items`} />
          <Inc items={[
            'Everything in "You add the items"',
            `We add your first ${we.includedItems} items for you`,
            'Your phone photos touched up and framed',
            'A photo guide so every dish looks its best',
            'Ready in about a week',
          ]} />
          <p className="mk-muted border-t border-current/20 pt-4 text-base">
            Extra item: <strong className="tabular-nums">+{formatUsd(we.extraItem.launch)}</strong>{' '}
            <s>{formatUsd(we.extraItem.list)}</s>
          </p>
        </article>

        <article data-tier="3d" className={`${card} mk-project-card grid content-start gap-4 p-6`}>
          <h3 className="mk-eyebrow">Menu with 3D · we do everything</h3>
          <Price launch={td.launch} list={td.list} note={`one-time · up to ${td.includedItems} items, all as 3D dishes`} />
          <Inc items={[
            'Everything in "We do everything"',
            `All ${td.includedItems} dishes as 3D dishes`,
            'Guests see the dish in 3D on their table, at real size',
            'Works on iPhone and Android, and in 3D on computers',
            'Made from your own dish photos',
          ]} />
          <p className="mk-muted border-t border-current/15 pt-4 text-base">
            Extra item with 3D: <strong className="tabular-nums">+{formatUsd(td.extraItemWith3D.launch)}</strong>{' '}
            <s>{formatUsd(td.extraItemWith3D.list)}</s>. Without 3D:{' '}
            <strong className="tabular-nums">+{formatUsd(td.extraItemWithout3D)}</strong>.
          </p>
        </article>
      </div>

      <div className="mt-10 grid items-start gap-8 border-t border-[var(--mk-line)] pt-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
        <div className="grid gap-2">
          <Eyebrow>Add 3D to any menu</Eyebrow>
          <h3 className="mk-h2 text-[clamp(1.75rem,3vw,2.5rem)]">Start with your best dishes.</h3>
          <p className="mk-muted text-base leading-relaxed">
            Each dish is scaled to the real plate: a 12-inch main, a 9-inch starter, an 8-inch dessert; drinks by glass height. You approve every dish before it goes live.
          </p>
          <p className="mk-muted text-base">{NFC_NOTE}</p>
        </div>
        <div className="grid gap-2">
          <div className="flex flex-wrap justify-between gap-3 border-b border-[var(--mk-line)] py-4 font-medium">
            <span>1 to {THREE_D_TIER_10 - 1} dishes</span><span className="tabular-nums">{formatUsd(ADDONS.threeDDish.launch)} each</span>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-b border-[var(--mk-line)] py-4 font-medium">
            <span>{THREE_D_TIER_10} dishes</span><span className="tabular-nums">{formatUsd(ADDONS.threeDDish.from10Total)}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-b border-[var(--mk-line)] py-4 font-medium">
            <span>{THREE_D_TIER_20} dishes or more</span><span className="tabular-nums">{formatUsd(ADDONS.threeDDish.from20Each)} each</span>
          </div>
        </div>
      </div>
    </section>
  )
}

type Cell = boolean | string
type Row = { group: string } | { label: string; menu: Cell; waiter: Cell; payments: Cell }

const ROWS: Row[] = [
  { group: 'Your menu website' },
  { label: 'Menu website on your domain or ours', menu: true, waiter: true, payments: true },
  { label: 'Photos, list and feed views', menu: true, waiter: true, payments: true },
  { label: '2 languages, hours, contacts, map', menu: true, waiter: true, payments: true },
  { label: '3D dishes viewer (for the dishes you bought in 3D)', menu: true, waiter: true, payments: true },
  { label: 'Visits and dish analytics', menu: true, waiter: true, payments: true },
  { label: 'Changes done by our team', menu: `${CHANGES_PER_MONTH} / month`, waiter: `${CHANGES_PER_MONTH} / month`, payments: `${CHANGES_PER_MONTH} / month` },
  { group: 'At the table' },
  { label: 'Staff take orders at the table', menu: false, waiter: true, payments: true },
  { label: 'Guests order from their phone', menu: false, waiter: false, payments: true },
  { label: 'Call the waiter from the phone', menu: false, waiter: true, payments: true },
  { label: 'Orders on the kitchen display', menu: false, waiter: true, payments: true },
  { label: 'One QR code per table', menu: false, waiter: true, payments: true },
  { group: 'Payments' },
  { label: 'Guests pay in the menu', menu: false, waiter: 'Paid the usual way', payments: true },
  { label: 'Card, Apple Pay and Google Pay', menu: false, waiter: false, payments: true },
  { label: 'Online pickup orders, paid ahead', menu: false, waiter: false, payments: true },
  { label: 'Money goes straight to your Stripe account', menu: false, waiter: false, payments: true },
  { label: 'Fee per payment through Xprout', menu: false, waiter: false, payments: `${PLANS.payments.paymentFeePercent}%` },
]

function CellView({ v, hl }: { v: Cell; hl?: boolean }) {
  const cls = `px-4 py-4 text-center border-b border-white/15 ${hl ? 'bg-white/5' : ''}`
  if (v === true) return <td className={cls}><Check className="mx-auto h-5 w-5" aria-label="Included" /></td>
  if (v === false) return <td className={cls}><Minus className="mk-muted mx-auto h-5 w-5" aria-label="Not included" /></td>
  return <td className={`${cls} text-base font-medium tabular-nums`}>{v}</td>
}

function PlansSection() {
  const [yearly, setYearly] = useState(false)
  const keys: PlanKey[] = ['menu', 'waiter', 'payments']
  const names: Record<PlanKey, string> = { menu: 'Menu', waiter: 'Waiter', payments: 'Payments' }
  const summaries: Record<PlanKey, { lead: string; features: string[] }> = {
    menu: {
      lead: 'A menu that does your food justice.',
      features: ['Your menu website, photos and feed', '2 languages and dish analytics', '3D viewer for dishes you bought in 3D'],
    },
    waiter: {
      lead: 'Bring the menu into your service.',
      features: ['Everything in Menu', 'Staff take orders at the table', 'Kitchen display and waiter calls'],
    },
    payments: {
      lead: 'From choosing a dish to paying for it.',
      features: ['Everything in Waiter', 'Guest ordering, online payments and pickup', 'Payments into your Stripe account'],
    },
  }
  const seg = `min-h-12 rounded-full px-4 py-3 text-base font-medium ${focus}`
  return (
    <section id="plans" aria-labelledby="monthly-title" className="mk-plans mk-dark mk-section scroll-mt-24">
      <div className="mk-container">
      <SectionHead id="monthly-title" eyebrow="02 / Ongoing service" title="From the first look to the last order." lead="Hosting, software, changes and support. Start with the menu; add table service and payments when you are ready." />
      <div role="group" aria-label="Billing period" data-yearly={yearly} className="mk-billing-switch mb-8 grid w-fit max-w-full grid-cols-2 gap-1 rounded-[28px] border border-white/25 p-1">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className={seg}>Monthly</button>
        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className={seg}>Yearly · {YEARLY_FREE_MONTHS} months free</button>
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {keys.map(key => (
          <article key={key} data-plan={key} className={`mk-plan-card grid min-w-0 content-start gap-5 rounded-[24px] border p-6 sm:p-8 ${key === 'waiter' ? 'border-white/50 bg-white/10' : 'border-white/25'}`}>
            <div className="grid gap-2">
              <h3 className="text-xl font-semibold">{names[key]}</h3>
              <p className="mk-muted text-base leading-relaxed">{summaries[key].lead}</p>
            </div>
            <p>
              <strong className="mk-price text-4xl font-semibold"><span key={String(yearly)} className="mk-price-swap">{formatUsd(yearly ? PLANS[key].yearly : PLANS[key].monthly)}</span></strong>
              <span className="mk-muted ml-2 text-base">{yearly ? 'per year' : 'per month'}</span>
            </p>
            <Inc items={summaries[key].features} />
            <p className="mk-muted border-t border-white/20 pt-4 text-base leading-relaxed">
              {PLANS[key].paymentFeePercent
                ? <>+ {PLANS[key].paymentFeePercent}% per payment through Xprout. Stripe&apos;s processing fee is separate.</>
                : 'No Xprout transaction fee.'}
            </p>
          </article>
        ))}
      </div>
      <details className="mk-comparison rounded-[24px] border border-white/25">
        <summary className={`cursor-pointer rounded-[24px] px-5 py-5 text-base font-medium sm:px-6 ${focus}`}>Compare everything included</summary>
        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
      <p className="mk-muted mb-3 text-base lg:hidden">Scroll the comparison to see every plan.</p>
      <div className={`overflow-x-auto rounded-[24px] border border-white/25 ${focus}`} tabIndex={0} role="region" aria-label="Plan comparison, scrollable">
        <table className="w-full min-w-[720px] border-collapse text-base">
          <caption className="sr-only">Menu, Waiter and Payments plans, {yearly ? 'annual' : 'monthly'} prices and included features</caption>
          <thead>
            <tr>
              <th scope="col" className="mk-muted w-[40%] px-5 py-8 text-left align-bottom text-base font-medium">What is included</th>
              {keys.map((k) => (
                <th key={k} scope="col" className={`px-5 py-8 text-center align-top ${k === 'waiter' ? 'bg-white/5' : ''}`}>
                  <span className="block text-lg font-medium">{names[k]}</span>
                  <span className="mk-price mt-4 block text-3xl font-semibold"><span key={String(yearly)} className="mk-price-swap">{formatUsd(yearly ? PLANS[k].yearly : PLANS[k].monthly)}</span></span>
                  <span className="mk-muted mt-2 block text-base font-normal">{yearly ? 'per year' : 'per month'}</span>
                  {PLANS[k].paymentFeePercent ? <span className="mk-muted mt-2 block text-base font-normal">+ {PLANS[k].paymentFeePercent}% per payment</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) =>
              'group' in r ? (
                <tr key={r.group}><th scope="colgroup" colSpan={4} className="border-y border-white/20 bg-white/5 px-5 py-4 text-left text-base font-semibold">{r.group}</th></tr>
              ) : (
                <tr key={r.label}>
                  <th scope="row" className="border-b border-white/15 px-5 py-4 text-left font-normal">{r.label}</th>
                  <CellView v={r.menu} />
                  <CellView v={r.waiter} hl />
                  <CellView v={r.payments} />
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
        </div>
      </details>
      <p className="mk-muted mt-6 max-w-3xl text-base leading-relaxed">
        The {PLANS.payments.paymentFeePercent}% applies only when the guest pays through Xprout. Stripe&apos;s own processing fee is charged by Stripe.
        {' '}{MIN_MONTHS}-month minimum, then month to month.
      </p>
      </div>
    </section>
  )
}

function Pair({ launch, list, unit }: { launch: ReactNode; list?: ReactNode; unit?: string }) {
  return (
    <span className="tabular-nums">
      <strong className="font-semibold">{launch}</strong>{unit ? <span className="mk-muted"> {unit}</span> : null}
      {list ? <s className="mk-muted ml-2">{list}</s> : null}
    </span>
  )
}

function AddonsSection() {
  const a = ADDONS
  const d = a.threeDDish
  const rows: Array<{ name: string; detail?: string; price: ReactNode }> = [
    { name: 'Extra language', detail: 'per language', price: <Pair launch={formatUsd(a.extraLanguage.launch)} list={formatUsd(a.extraLanguage.list)} /> },
    { name: 'Extra item added by us', price: <Pair launch={formatUsd(a.extraItem.launch)} list={formatUsd(a.extraItem.list)} /> },
    { name: 'Photo touch-up', detail: 'for restaurants that add their own items', price: <Pair launch={formatUsd(a.photoTouchUp.launch)} list={formatUsd(a.photoTouchUp.list)} unit="per photo" /> },
    {
      name: '3D dish',
      detail: `${formatUsd(d.from10Each)} each from ${THREE_D_TIER_10} dishes (${THREE_D_TIER_10} = ${formatUsd(d.from10Total)}); ${formatUsd(d.from20Each)} each from ${THREE_D_TIER_20} dishes`,
      price: <Pair launch={formatUsd(d.launch)} list={formatUsd(d.list)} unit="each" />,
    },
    { name: '3D drink in a glass', price: <Pair launch={formatUsd(a.threeDDrink.launch)} list={formatUsd(a.threeDDrink.list)} /> },
    { name: 'Redo a 3D dish after a plating change', price: <Pair launch={`${a.redoThreeDPercent}%`} unit="of its price" /> },
    { name: `Extra change request beyond ${CHANGES_PER_MONTH} per month`, price: <Pair launch={formatUsd(a.extraChange.launch)} list={formatUsd(a.extraChange.list)} /> },
    { name: 'AI chat that answers guests', detail: 'text and voice', price: <Pair launch={formatUsd(a.aiChat.monthly)} unit="/ month" /> },
    { name: 'Growth', detail: 'AI chat + monthly blog/SEO content + unlimited languages', price: <Pair launch={formatUsd(a.growth.monthly)} list={formatUsd(a.growth.listMonthly)} unit="/ month" /> },
    { name: 'Extra location', price: <Pair launch={formatUsd(a.extraLocation.monthly)} list={formatUsd(a.extraLocation.listMonthly)} unit="/ month" /> },
  ]
  return (
    <section aria-labelledby="addons-title" className="mk-container mk-section">
      <SectionHead id="addons-title" eyebrow="The finishing touches" title="Room to make it yours." lead="Add what your menu needs, at the pace that works for you. Launch prices are shown beside the regular prices." />
      <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-2">
        {[
          { title: 'Content & presentation', items: rows.slice(0, 3) },
          { title: 'Your dishes in 3D', items: rows.slice(3, 6) },
          { title: 'Support & growth', items: rows.slice(6) },
        ].map(group => (
          <div key={group.title} className="min-w-0">
            <h3 className="mk-eyebrow mb-2 border-b border-[var(--mk-line)] pb-4">{group.title}</h3>
            <dl>
              {group.items.map(row => (
                <div key={row.name} className="grid gap-2 border-b border-[var(--mk-line)] py-5 sm:grid-cols-[1fr_auto] sm:gap-6">
                  <dt className="min-w-0 text-base font-medium">
                    {row.name}
                    {row.detail && <span className="mk-muted mt-1 block text-base font-normal leading-relaxed">{row.detail}</span>}
                  </dt>
                  <dd className="text-base sm:max-w-48 sm:text-right">{row.price}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}

function Estimator() {
  const uid = useId()
  const [mode, setMode] = useState<EstimateMode>('we')
  const [items, setItems] = useState('40')
  const [threeD, setThreeD] = useState('10')
  const [langs, setLangs] = useState('0')
  const [photos, setPhotos] = useState('0')
  const [plan, setPlan] = useState<PlanKey>('waiter')

  const n = (v: string) => parseInt(v, 10) || 0
  const e = estimateProject({ mode, items: n(items), threeDDishes: n(threeD), extraLanguages: n(langs), photos: n(photos), plan })

  const field = `min-h-12 min-w-0 w-full rounded-xl border border-[var(--mk-line)] bg-[var(--mk-panel)] px-3 py-3 text-base font-normal text-[var(--mk-ink)] ${focus}`
  const label = 'grid min-w-0 content-start gap-2 text-base font-medium'
  const hint = 'mk-muted text-base font-normal leading-relaxed'
  const line = (name: string, v: number, extra?: string) => (
    <div className="flex justify-between gap-4"><span className="min-w-0">{name}{extra ? ` (${extra})` : ''}</span><span className="shrink-0 tabular-nums">{formatUsd(v)}</span></div>
  )

  return (
    <section id="estimate" aria-labelledby="estimate-title" className="mk-estimator mk-container mk-section scroll-mt-24 border-t border-[var(--mk-line)]">
      <SectionHead id="estimate-title" eyebrow="A little clarity" title="Picture your menu. See your estimate." lead="Explore the options before we talk. Your first month is part of the project, so the ongoing plan starts in month two." />
      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <form className={`${card} grid min-w-0 content-start gap-6 p-5 sm:grid-cols-2 sm:p-8`} onSubmit={(ev) => ev.preventDefault()} noValidate>
          <label htmlFor={`${uid}-mode`} className={label}>Who adds the items?
            <select id={`${uid}-mode`} className={field} value={mode} onChange={(ev) => setMode(ev.target.value as EstimateMode)}>
              <option value="we">We do everything</option>
              <option value="diy">You add the items</option>
            </select>
          </label>
          <label htmlFor={`${uid}-items`} className={label}>Items on the menu
            <input id={`${uid}-items`} className={field} type="number" inputMode="numeric" min={0} max={MAX_ITEMS} value={items} onChange={(ev) => setItems(ev.target.value)} />
            <span className={hint}>{mode === 'diy' ? 'You add them yourself, no extra cost.' : `${PROJECTS.we.includedItems} included, then ${formatUsd(PROJECTS.we.extraItem.launch)} each.`}</span>
          </label>
          <label htmlFor={`${uid}-3d`} className={label}>Dishes in 3D
            <input id={`${uid}-3d`} className={field} type="number" inputMode="numeric" min={0} max={MAX_ITEMS} value={threeD} onChange={(ev) => setThreeD(ev.target.value)} />
            <span className={hint}>{formatUsd(ADDONS.threeDDish.launch)} each, {THREE_D_TIER_10} for {formatUsd(ADDONS.threeDDish.from10Total)}, {formatUsd(ADDONS.threeDDish.from20Each)} each from {THREE_D_TIER_20}.</span>
          </label>
          <label htmlFor={`${uid}-lang`} className={label}>Extra languages
            <input id={`${uid}-lang`} className={field} type="number" inputMode="numeric" min={0} max={MAX_LANGUAGES} value={langs} onChange={(ev) => setLangs(ev.target.value)} />
            <span className={hint}>{formatUsd(ADDONS.extraLanguage.launch)} per language.</span>
          </label>
          {mode === 'diy' && (
            <label htmlFor={`${uid}-photos`} className={label}>Photos you want touched up
              <input id={`${uid}-photos`} className={field} type="number" inputMode="numeric" min={0} value={photos} onChange={(ev) => setPhotos(ev.target.value)} />
              <span className={hint}>{formatUsd(ADDONS.photoTouchUp.launch)} per photo.</span>
            </label>
          )}
          <label htmlFor={`${uid}-plan`} className={label}>Monthly version
            <select id={`${uid}-plan`} className={field} value={plan} onChange={(ev) => setPlan(ev.target.value as PlanKey)}>
              <option value="menu">Menu · {formatUsd(PLANS.menu.monthly)}</option>
              <option value="waiter">Waiter · {formatUsd(PLANS.waiter.monthly)}</option>
              <option value="payments">Payments · {formatUsd(PLANS.payments.monthly)} + {PLANS.payments.paymentFeePercent}%</option>
            </select>
          </label>
        </form>

        <div className="mk-estimate-result mk-dark grid min-w-0 content-start gap-6 rounded-[24px] p-5 sm:p-8" aria-live="polite" aria-atomic="true">
          <p className="mk-eyebrow">Your estimate</p>
          <div className="grid gap-3 text-base">
            {line('Menu build', e.base, mode === 'diy' ? 'you add the items' : `${PROJECTS.we.includedItems} items included`)}
            {line('Extra items', e.extraItems)}
            {line('3D dishes', e.threeD, e.threeDCount ? String(e.threeDCount) : undefined)}
            {line('Extra languages', e.languages)}
            {mode === 'diy' && line('Photo touch-ups', e.photoTouchUps)}
            <div className="flex justify-between gap-4 border-t border-white/25 pt-4 text-base font-semibold"><span>Project, one-time</span><span className="shrink-0 tabular-nums">{formatUsd(e.project)}</span></div>
          </div>
          <p className="mk-price text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-none">{formatUsd(e.project)}</p>
          <p className="mk-muted text-base leading-relaxed">
            Then {formatUsd(e.monthly)} / month from month two{e.paymentFeePercent ? `, plus ${e.paymentFeePercent}% of payments made through Xprout` : ''}.
          </p>
          <p className="mk-muted text-base leading-relaxed">First year: <strong className="tabular-nums">{formatUsd(e.firstYear)}</strong> (first month included in the project).</p>
          <a href={PRICING_CTA_HREF} className={`${ctaBtn} mk-button--light w-full sm:w-fit`}>Start your project <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { t: 'Send your menu', d: 'Your current menu and phone photos of your dishes. Our guide shows how to shoot them.' },
  { t: 'We build it', d: 'Your menu website, translations, QR codes and 3D dishes, in about a week.' },
  { t: 'You approve', d: 'We walk you through it on a video call and you sign off on every dish.' },
  { t: 'We keep it fresh', d: 'New dishes, prices and specials: send them, we update them.' },
]

function ProcessSection() {
  return (
    <section aria-labelledby="how-title" className="mk-container mk-section border-t border-[var(--mk-line)]">
      <SectionHead id="how-title" eyebrow="From your kitchen to their screen" title="A personal process. From anywhere." />
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.t} className="grid content-start gap-3 border-t border-[var(--mk-line)] pt-6">
            <span className="mk-price mb-3 text-3xl font-medium" aria-hidden="true">0{i + 1}</span>
            <h3 className="text-lg font-semibold">{s.t}</h3>
            <p className="mk-muted text-base leading-relaxed">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function PricingClient({ appName, logoUrl, footerData }: {
  appName?: string | null
  logoUrl?: string | null
  footerData?: FooterData | null
}) {
  return (
      <div className="min-h-screen bg-[var(--mk-paper)] text-[var(--mk-ink)]">
        <Nav appName={appName} logoUrl={logoUrl} startHref={PRICING_CTA_HREF} activePage="pricing" />
        <main>
          <header className="mk-pricing-hero mk-container mk-section">
            <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
              <div className="grid gap-6">
                <span className="mk-eyebrow">Pricing / A menu worth gathering around</span>
                <h1 className="mk-display max-w-3xl">A beautiful menu.<br />A clear investment.</h1>
                <p className="mk-lead max-w-2xl">One project to bring your menu to life. One ongoing plan to keep it working beautifully, service after service.</p>
                <div className="flex flex-wrap gap-3">
                  <a href="#projects" className={ctaBtn}>Explore the options <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                  <a href="#estimate" className="mk-button mk-button--outline">Estimate your project</a>
                </div>
              </div>
              <div className="mk-cost-summary grid gap-6 border-y border-[var(--mk-line)] py-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="mk-muted text-base">One-time setup from</span>
                  <strong className="mk-price text-4xl font-semibold">{formatUsd(PROJECTS.diy.launch)}</strong>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="mk-muted text-base">Then plans from</span>
                  <span><strong className="mk-price text-4xl font-semibold">{formatUsd(PLANS.menu.monthly)}</strong><span className="mk-muted text-base"> / month</span></span>
                </div>
                <p className="mk-muted text-base leading-relaxed">First month included in your project. Launch pricing for our first {LAUNCH_SLOTS} restaurants. All prices in USD.</p>
              </div>
            </div>
          </header>
          <BuildSection />
          <PlansSection />
          <AddonsSection />
          <Estimator />
          <ProcessSection />
          <section className="mk-container grid gap-6 border-t border-[var(--mk-line)] py-12 sm:py-16" aria-label="Commercial terms">
            <p className="mk-eyebrow">The details, in plain sight</p>
            <div className="mk-muted grid gap-4 text-base leading-relaxed md:grid-cols-2 md:gap-16">
              <p>Launch prices are valid for our first {LAUNCH_SLOTS} restaurants or until {LAUNCH_ENDS}, whichever comes first. Crossed-out prices are our regular prices.</p>
              <p>Project paid {PAYMENT_SPLIT.start}% to start and {PAYMENT_SPLIT.launch}% at launch. Monthly plans have a {MIN_MONTHS}-month minimum, then month to month. All prices in US dollars, before tax. {NFC_NOTE}</p>
            </div>
            <a href={PRICING_CTA_HREF} className={`${ctaBtn} mt-2 w-fit max-w-full`}>Start your project <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </section>
        </main>
        <Footer data={footerData} appName={appName} logoUrl={logoUrl} />
      </div>
  )
}
