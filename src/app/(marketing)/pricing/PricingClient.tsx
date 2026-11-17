'use client'

import { useId, useState } from 'react'
import { Check, Minus, ArrowRight, Plus } from 'lucide-react'
import { Nav, Footer, type FooterData } from '@/components/marketing/MarketingChrome'
import {
  ADDONS, CHANGES_PER_MONTH, LAUNCH_ENDS, LAUNCH_SLOTS, MAX_ITEMS, MAX_LANGUAGES, MIN_MONTHS, NFC_NOTE, PAYMENT_SPLIT,
  PLANS, PRICING_CTA_HREF, PROJECTS, THREE_D_TIER_10, THREE_D_TIER_20, YEARLY_FREE_MONTHS,
  estimateProject, formatUsd, type PlanKey,
} from '@/lib/marketing/pricing'

/*
 * Reading order: the offer in one line (setup paid once + plan paid monthly),
 * then step 1 (setup), step 2 (plan), optional extras and an optional estimate.
 * Every number comes from src/lib/marketing/pricing.ts.
 */

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current'
const ctaBtn = 'mk-button'

function SectionHead({ step, title, lead, id }: { step: string; title: string; lead?: string; id: string }) {
  return (
    <div className="mb-10 grid gap-4">
      <p className="mk-eyebrow">{step}</p>
      <h2 id={id} className="mk-h2 max-w-3xl">{title}</h2>
      {lead && <p className="mk-lead max-w-2xl">{lead}</p>}
    </div>
  )
}

/** Launch price big, regular price crossed out next to it. */
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

function OfferSummary() {
  return (
    <div className="mk-cost-summary grid gap-5" aria-label="What you pay">
      <div className="grid gap-1">
        <span className="mk-eyebrow">Setup · paid once</span>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <strong className="mk-price text-5xl font-semibold">{formatUsd(PROJECTS.we.launch)}</strong>
          <s className="mk-muted text-base tabular-nums" aria-label={`regular price ${formatUsd(PROJECTS.we.list)}`}>{formatUsd(PROJECTS.we.list)}</s>
        </p>
        <span className="mk-muted text-base">We build your menu with your first {PROJECTS.we.includedItems} dishes.</span>
      </div>
      <div className="mk-offer-plus" aria-hidden="true"><Plus className="h-4 w-4" /></div>
      <div className="grid gap-1">
        <span className="mk-eyebrow">Plan · paid monthly</span>
        <p><span className="mk-muted text-base">from </span><strong className="mk-price text-5xl font-semibold">{formatUsd(PLANS.menu.monthly)}</strong><span className="mk-muted text-base"> / month</span></p>
        <span className="mk-muted text-base">Starts in month two. The first month comes with your setup.</span>
      </div>
      <p className="mk-muted border-t border-current/15 pt-4 text-sm leading-relaxed">Launch prices for our first {LAUNCH_SLOTS} restaurants. All prices in USD.</p>
    </div>
  )
}

function SetupSection() {
  const we = PROJECTS.we
  const td = PROJECTS.threeD
  const d = ADDONS.threeDDish
  return (
    <section id="setup" aria-labelledby="setup-title" className="mk-container mk-section scroll-mt-24">
      <SectionHead id="setup-title" step="Step 1 · Paid once" title="Setup: we build your menu." lead="Send us your menu and phone photos. Our team builds the website, adds every dish and gets it ready in about a week. Both options include your first month." />
      <div className="grid gap-5 md:grid-cols-2">
        <article data-tier="complete" className="mk-project-card mk-dark grid min-w-0 content-start gap-5 rounded-[24px] p-6 sm:p-8">
          <h3 className="mk-eyebrow">Menu website</h3>
          <Price launch={we.launch} list={we.list} note={`one-time · up to ${we.includedItems} dishes`} />
          <Inc items={[
            'Menu website with your logo and colours',
            `Your first ${we.includedItems} dishes added by our team`,
            'Your phone photos touched up and framed',
            '2 languages, hours, contacts and map',
            'SEO pages and QR codes for your tables',
            'A video call to walk you through it',
          ]} />
          <p className="mk-muted border-t border-current/20 pt-4 text-base">
            More dishes: <strong className="tabular-nums">+{formatUsd(we.extraItem.launch)}</strong> each
          </p>
        </article>

        <article data-tier="3d" className="mk-panel mk-project-card grid min-w-0 content-start gap-5 rounded-[24px] border p-6 sm:p-8">
          <h3 className="mk-eyebrow">Menu website with 3D dishes</h3>
          <Price launch={td.launch} list={td.list} note={`one-time · up to ${td.includedItems} dishes, all in 3D`} />
          <Inc items={[
            'Everything in Menu website',
            `All ${td.includedItems} dishes made in 3D from your photos`,
            'On supported phones, guests can see the dish on their table at real size',
            'On computers, guests turn each dish around in 3D',
            'You approve every dish before it goes live',
          ]} />
          <p className="mk-muted border-t border-current/15 pt-4 text-base">
            More dishes: <strong className="tabular-nums">+{formatUsd(td.extraItemWith3D.launch)}</strong> each in 3D,{' '}
            <strong className="tabular-nums">+{formatUsd(td.extraItemWithout3D)}</strong> without 3D
          </p>
        </article>
      </div>

      <div className="mt-6 grid gap-3 rounded-[24px] border border-[var(--mk-line)] p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center md:gap-8">
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold">Prefer to start with a few 3D dishes?</h3>
          <p className="mk-muted text-base leading-relaxed">Choose the Menu website and add 3D to your best dishes, now or later.</p>
        </div>
        <p className="text-base font-medium tabular-nums md:text-right">
          {formatUsd(d.launch)} each · {THREE_D_TIER_10} for {formatUsd(d.from10Total)} · {formatUsd(d.from20Each)} each from {THREE_D_TIER_20}
        </p>
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
  { label: '3D viewer for the dishes you have in 3D', menu: true, waiter: true, payments: true },
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

const PLAN_NAMES: Record<PlanKey, string> = { menu: 'Menu', waiter: 'Waiter', payments: 'Payments' }

function PlansSection() {
  const [yearly, setYearly] = useState(false)
  const keys: PlanKey[] = ['menu', 'waiter', 'payments']
  const summaries: Record<PlanKey, { lead: string; features: string[] }> = {
    menu: {
      lead: 'Your menu online, always up to date.',
      features: ['Hosting, support and your menu website', `${CHANGES_PER_MONTH} changes a month done by our team`, 'Dish analytics and the 3D viewer'],
    },
    waiter: {
      lead: 'Your staff take orders from the menu.',
      features: ['Everything in Menu', 'Staff take orders at the table', 'Kitchen display and waiter calls'],
    },
    payments: {
      lead: 'Guests order and pay from their phone.',
      features: ['Everything in Waiter', 'Guest ordering, online payments and pickup', 'Money goes to your Stripe account'],
    },
  }
  const seg = `min-h-12 rounded-full px-4 py-3 text-base font-medium ${focus}`
  const price = (k: PlanKey) => formatUsd(yearly ? PLANS[k].yearly : PLANS[k].monthly)
  const per = yearly ? 'per year' : 'per month'
  return (
    <section id="plans" aria-labelledby="monthly-title" className="mk-plans mk-dark mk-section scroll-mt-24">
      <div className="mk-container">
        <SectionHead id="monthly-title" step="Step 2 · Paid monthly" title="Plan: we keep it running." lead="Hosting, support and changes by our team. Starts in month two. Begin with Menu and move up when you want ordering or payments." />
        <div role="group" aria-label="Billing period" data-yearly={yearly} className="mk-billing-switch mb-8 grid w-fit max-w-full grid-cols-2 gap-1 rounded-[28px] border border-white/25 p-1">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className={seg}>Monthly</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className={seg}>Yearly · {YEARLY_FREE_MONTHS} months free</button>
        </div>
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          {keys.map(key => (
            <article key={key} data-plan={key} className={`mk-plan-card grid min-w-0 content-start gap-4 rounded-[24px] border p-5 sm:gap-5 sm:p-8 ${key === 'waiter' ? 'border-white/50 bg-white/10' : 'border-white/25'}`}>
              <div className="grid gap-2">
                <h3 className="text-xl font-semibold">{PLAN_NAMES[key]}</h3>
                <p className="mk-muted text-base leading-relaxed">{summaries[key].lead}</p>
              </div>
              <p>
                <strong className="mk-price text-4xl font-semibold"><span key={String(yearly)} className="mk-price-swap">{price(key)}</span></strong>
                <span className="mk-muted ml-2 text-base">{per}</span>
              </p>
              <Inc items={summaries[key].features} />
              <p className="mk-muted border-t border-white/20 pt-4 text-base leading-relaxed">
                {PLANS[key].paymentFeePercent
                  ? <>+ {PLANS[key].paymentFeePercent}% per payment through Xprout. Stripe&apos;s processing fee is separate.</>
                  : 'No fee on your sales.'}
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
                        <span className="block text-lg font-medium">{PLAN_NAMES[k]}</span>
                        <span className="mk-price mt-4 block text-3xl font-semibold"><span key={String(yearly)} className="mk-price-swap">{price(k)}</span></span>
                        <span className="mk-muted mt-2 block text-base font-normal">{per}</span>
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
        <p className="mk-muted mt-6 max-w-3xl text-base leading-relaxed">{MIN_MONTHS}-month minimum, then month to month.</p>
      </div>
    </section>
  )
}

function ExtrasSection() {
  const a = ADDONS
  const groups: Array<{ title: string; rows: Array<{ name: string; detail?: string; price: string }> }> = [
    {
      title: 'Paid once',
      rows: [
        { name: 'Extra language', price: `${formatUsd(a.extraLanguage.launch)} each` },
        { name: '3D drink in its glass', price: `${formatUsd(a.threeDDrink.launch)} each` },
        { name: 'Redo a 3D dish after a plating change', price: `${a.redoThreeDPercent}% of its price` },
        { name: 'Extra change request', detail: `Beyond the ${CHANGES_PER_MONTH} included each month`, price: `${formatUsd(a.extraChange.launch)} each` },
      ],
    },
    {
      title: 'Added to your plan',
      rows: [
        { name: 'AI chat that answers guests', detail: 'Text and voice', price: `${formatUsd(a.aiChat.monthly)} / month` },
        { name: 'Growth', detail: 'AI chat, monthly blog and SEO content, unlimited languages', price: `${formatUsd(a.growth.monthly)} / month` },
        { name: 'Extra location', price: `${formatUsd(a.extraLocation.monthly)} / month` },
      ],
    },
  ]
  return (
    <section id="extras" aria-labelledby="extras-title" className="mk-container mk-section scroll-mt-24">
      <SectionHead id="extras-title" step="Optional" title="Extras, only if you need them." />
      <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-2">
        {groups.map(group => (
          <div key={group.title} className="min-w-0">
            <h3 className="mk-eyebrow mb-2 border-b border-[var(--mk-line)] pb-4">{group.title}</h3>
            <dl>
              {group.rows.map(row => (
                <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 border-b border-[var(--mk-line)] py-4">
                  <dt className="min-w-0 text-base font-medium">
                    {row.name}
                    {row.detail && <span className="mk-muted block text-base font-normal leading-relaxed">{row.detail}</span>}
                  </dt>
                  <dd className="text-base font-semibold tabular-nums">{row.price}</dd>
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
  const [items, setItems] = useState('40')
  const [threeD, setThreeD] = useState('10')
  const [langs, setLangs] = useState('0')
  const [plan, setPlan] = useState<PlanKey>('menu')

  const n = (v: string) => parseInt(v, 10) || 0
  const e = estimateProject({ items: n(items), threeDDishes: n(threeD), extraLanguages: n(langs), plan })

  const field = `min-h-12 min-w-0 w-full rounded-xl border border-[var(--mk-line)] bg-[var(--mk-panel)] px-3 py-3 text-base font-normal text-[var(--mk-ink)] ${focus}`
  const label = 'grid min-w-0 content-start gap-2 text-base font-medium'
  const hint = 'mk-muted text-base font-normal leading-relaxed'
  const line = (name: string, v: number) => (
    <div className="flex justify-between gap-4"><span className="min-w-0">{name}</span><span className="shrink-0 tabular-nums">{formatUsd(v)}</span></div>
  )

  return (
    <section id="estimate" aria-labelledby="estimate-title" className="mk-estimator mk-container mk-section scroll-mt-24">
      <SectionHead id="estimate-title" step="Optional" title="Want an exact number?" lead="Tell us about your menu and see what you would pay." />
      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <form className="mk-panel grid min-w-0 content-start gap-6 rounded-[24px] border border-[var(--mk-line)] p-5 sm:grid-cols-2 sm:p-8" onSubmit={(ev) => ev.preventDefault()} noValidate>
          <label htmlFor={`${uid}-items`} className={label}>Dishes on your menu
            <input id={`${uid}-items`} className={field} type="number" inputMode="numeric" min={0} max={MAX_ITEMS} value={items} onChange={(ev) => setItems(ev.target.value)} />
            <span className={hint}>{PROJECTS.we.includedItems} included, then {formatUsd(PROJECTS.we.extraItem.launch)} each.</span>
          </label>
          <label htmlFor={`${uid}-3d`} className={label}>Of those, dishes in 3D
            <input id={`${uid}-3d`} className={field} type="number" inputMode="numeric" min={0} max={MAX_ITEMS} value={threeD} onChange={(ev) => setThreeD(ev.target.value)} />
            <span className={hint}>{formatUsd(ADDONS.threeDDish.launch)} each, less from {THREE_D_TIER_10}.</span>
          </label>
          <label htmlFor={`${uid}-lang`} className={label}>Extra languages
            <input id={`${uid}-lang`} className={field} type="number" inputMode="numeric" min={0} max={MAX_LANGUAGES} value={langs} onChange={(ev) => setLangs(ev.target.value)} />
            <span className={hint}>2 are included.</span>
          </label>
          <label htmlFor={`${uid}-plan`} className={label}>Plan
            <select id={`${uid}-plan`} className={field} value={plan} onChange={(ev) => setPlan(ev.target.value as PlanKey)}>
              <option value="menu">Menu · {formatUsd(PLANS.menu.monthly)} / month</option>
              <option value="waiter">Waiter · {formatUsd(PLANS.waiter.monthly)} / month</option>
              <option value="payments">Payments · {formatUsd(PLANS.payments.monthly)} / month + {PLANS.payments.paymentFeePercent}%</option>
            </select>
          </label>
        </form>

        <div className="mk-estimate-result mk-dark grid min-w-0 content-start gap-6 rounded-[24px] p-5 sm:p-8" aria-live="polite" aria-atomic="true">
          <div className="grid gap-2">
            <p className="mk-eyebrow">Setup · paid once</p>
            <p className="mk-price text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-none">{formatUsd(e.project)}</p>
          </div>
          <div className="grid gap-3 border-t border-white/25 pt-4 text-base">
            {line(`Menu website with ${PROJECTS.we.includedItems} dishes`, e.base)}
            {e.extraItems > 0 && line('More dishes', e.extraItems)}
            {e.threeDCount > 0 && line(`${e.threeDCount} ${e.threeDCount === 1 ? 'dish' : 'dishes'} in 3D`, e.threeD)}
            {e.languages > 0 && line('Extra languages', e.languages)}
          </div>
          <div className="grid gap-2 border-t border-white/25 pt-4">
            <p className="mk-eyebrow">Plan · paid monthly</p>
            <p className="text-base leading-relaxed">
              <strong className="mk-price text-3xl font-semibold">{formatUsd(e.monthly)}</strong>
              <span className="mk-muted"> / month from month two{e.paymentFeePercent ? `, plus ${e.paymentFeePercent}% of payments through Xprout` : ''}</span>
            </p>
          </div>
          <a href={PRICING_CTA_HREF} className={`${ctaBtn} mk-button--light w-full sm:w-fit`}>Get started <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { t: 'Send your menu', d: 'Your current menu and phone photos of your dishes. Our guide shows how to shoot them.' },
  { t: 'We build it', d: 'Your menu website, translations, QR codes and any 3D dishes, in about a week.' },
  { t: 'You approve', d: 'We walk you through it on a video call and you sign off on every dish.' },
  { t: 'We keep it fresh', d: 'New dishes, prices and specials: send them, we update them.' },
]

function ProcessSection() {
  return (
    <section aria-labelledby="how-title" className="mk-container mk-section border-t border-[var(--mk-line)]">
      <SectionHead id="how-title" step="How it works" title="From your kitchen to their screen." />
      <ol className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.t} className="grid grid-cols-[3rem_1fr] content-start gap-x-3 gap-y-2 border-t border-[var(--mk-line)] pt-5 sm:grid-cols-1 sm:gap-3 sm:pt-6">
            <span className="mk-price row-span-2 text-3xl font-medium sm:row-span-1 sm:mb-3" aria-hidden="true">0{i + 1}</span>
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
          <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
            <div className="grid gap-6">
              <span className="mk-eyebrow">Pricing</span>
              <h1 className="mk-display max-w-3xl">One setup.<br />One monthly plan.</h1>
              <p className="mk-lead max-w-2xl">We build your menu website, add your dishes and photos, and keep it up to date. You pay once for the setup, then a monthly plan.</p>
              <div className="flex flex-wrap gap-3">
                <a href={PRICING_CTA_HREF} className={ctaBtn}>Get started <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                <a href="#estimate" className="mk-button mk-button--outline">Estimate your price</a>
              </div>
            </div>
            <OfferSummary />
          </div>
        </header>
        <SetupSection />
        <PlansSection />
        <ExtrasSection />
        <Estimator />
        <ProcessSection />
        <section className="mk-container grid gap-6 border-t border-[var(--mk-line)] py-12 sm:py-16" aria-label="Commercial terms">
          <p className="mk-eyebrow">The details</p>
          <div className="mk-muted grid gap-4 text-base leading-relaxed md:grid-cols-2 md:gap-16">
            <p>Launch prices are valid for our first {LAUNCH_SLOTS} restaurants or until {LAUNCH_ENDS}, whichever comes first. Crossed-out prices are our regular prices. 3D is made for the dishes you choose; seeing a dish on the table needs a supported phone.</p>
            <p>Setup paid {PAYMENT_SPLIT.start}% to start and {PAYMENT_SPLIT.launch}% at launch. Plans have a {MIN_MONTHS}-month minimum, then month to month. All prices in US dollars, before tax. {NFC_NOTE}</p>
          </div>
          <a href={PRICING_CTA_HREF} className={`${ctaBtn} mt-2 w-fit max-w-full`}>Get started <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        </section>
      </main>
      <Footer data={footerData} appName={appName} logoUrl={logoUrl} />
    </div>
  )
}
