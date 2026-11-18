'use client'

import { useId, useState } from 'react'
import { Check, Minus, ArrowRight, Plus } from 'lucide-react'
import { Nav, Footer, type FooterData } from '@/components/marketing/MarketingChrome'
import { usePublicLocale } from '@/components/marketing/PublicLocale'
import {
  ADDONS, CHANGES_PER_MONTH, LAUNCH_SLOTS, MAX_ITEMS, MAX_LANGUAGES, MIN_MONTHS, NFC_NOTE, PAYMENT_SPLIT,
  PLANS, PRICING_CTA_HREF, PROJECTS, THREE_D_TIER_10, THREE_D_TIER_20, YEARLY_FREE_MONTHS,
  estimateProject, formatLaunchEnd, formatUsd, type PlanKey,
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
  const { locale, t } = usePublicLocale()
  const listPrice = formatUsd(list, locale)
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <strong className="mk-price text-[clamp(2.5rem,4vw,3.5rem)] font-semibold leading-none">{formatUsd(launch, locale)}</strong>
      <s className="mk-muted text-base tabular-nums" aria-label={t('regular price {price}', { price: listPrice })}>{listPrice}</s>
      {note && <span className="mk-muted w-full pt-2 text-base">{note}</span>}
    </div>
  )
}

function Inc({ items }: { items: string[] }) {
  const { t } = usePublicLocale()
  return (
    <ul className="grid gap-3 text-base leading-relaxed">
      {items.map(item => (
        <li key={item} className="grid grid-cols-[18px_1fr] gap-2">
          <Check className="mt-1 h-4 w-4" aria-hidden="true" />
          <span>{t(item)}</span>
        </li>
      ))}
    </ul>
  )
}

function OfferSummary() {
  const { locale, t } = usePublicLocale()
  const listPrice = formatUsd(PROJECTS.we.list, locale)
  return (
    <div className="mk-cost-summary grid gap-5" aria-label={t('What you pay')}>
      <div className="grid gap-1">
        <span className="mk-eyebrow">{t('Setup · paid once')}</span>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <strong className="mk-price text-5xl font-semibold">{formatUsd(PROJECTS.we.launch, locale)}</strong>
          <s className="mk-muted text-base tabular-nums" aria-label={t('regular price {price}', { price: listPrice })}>{listPrice}</s>
        </p>
        <span className="mk-muted text-base">{t('We build your menu with your first {count} dishes.', { count: PROJECTS.we.includedItems })}</span>
      </div>
      <div className="mk-offer-plus" aria-hidden="true"><Plus className="h-4 w-4" /></div>
      <div className="grid gap-1">
        <span className="mk-eyebrow">{t('Plan · paid monthly')}</span>
        <p><span className="mk-muted text-base">{t('from')}{' '}</span><strong className="mk-price text-5xl font-semibold">{formatUsd(PLANS.menu.monthly, locale)}</strong><span className="mk-muted text-base">{' '}{t('/ month')}</span></p>
        <span className="mk-muted text-base">{t('Starts in month two. The first month comes with your setup.')}</span>
      </div>
      <p className="mk-muted border-t border-current/15 pt-4 text-sm leading-relaxed">{t('Launch prices for our first {count} restaurants. All prices in USD.', { count: LAUNCH_SLOTS })}</p>
    </div>
  )
}

function SetupSection() {
  const { locale, t } = usePublicLocale()
  const we = PROJECTS.we
  const td = PROJECTS.threeD
  const d = ADDONS.threeDDish
  return (
    <section id="setup" aria-labelledby="setup-title" className="mk-container mk-section scroll-mt-24">
      <SectionHead id="setup-title" step={t('Step 1 · Paid once')} title={t('Setup: we build your menu.')} lead={t('Send us your menu and phone photos. Our team builds the website, adds every dish and gets it ready in about a week. Both options include your first month.')} />
      <div className="grid gap-5 md:grid-cols-2">
        <article data-tier="complete" className="mk-project-card mk-dark grid min-w-0 content-start gap-5 rounded-[24px] p-6 sm:p-8">
          <h3 className="mk-eyebrow">{t('Menu website')}</h3>
          <Price launch={we.launch} list={we.list} note={t('one-time · up to {count} dishes', { count: we.includedItems })} />
          <Inc items={[
            'Menu website with your logo and colours',
            t('Your first {count} dishes added by our team', { count: we.includedItems }),
            'Your phone photos touched up and framed',
            '2 languages, hours, contacts and map',
            'SEO pages and QR codes for your tables',
            'A video call to walk you through it',
          ]} />
          <p className="mk-muted border-t border-current/20 pt-4 text-base">
            {t('More dishes:')}{' '}<strong className="tabular-nums">+{formatUsd(we.extraItem.launch, locale)}</strong>{' '}{t('each')}
          </p>
        </article>

        <article data-tier="3d" className="mk-panel mk-project-card grid min-w-0 content-start gap-5 rounded-[24px] border p-6 sm:p-8">
          <h3 className="mk-eyebrow">{t('Menu website with 3D dishes')}</h3>
          <Price launch={td.launch} list={td.list} note={t('one-time · up to {count} dishes, all in 3D', { count: td.includedItems })} />
          <Inc items={[
            'Everything in Menu website',
            t('All {count} dishes made in 3D from your photos', { count: td.includedItems }),
            'On supported phones, guests can see the dish on their table at real size',
            'On computers, guests turn each dish around in 3D',
            'You approve every dish before it goes live',
          ]} />
          <p className="mk-muted border-t border-current/15 pt-4 text-base">
            {t('More dishes:')}{' '}<strong className="tabular-nums">+{formatUsd(td.extraItemWith3D.launch, locale)}</strong>{' '}{t('each in 3D')},{' '}
            <strong className="tabular-nums">+{formatUsd(td.extraItemWithout3D, locale)}</strong>{' '}{t('without 3D')}
          </p>
        </article>
      </div>

      <div className="mt-6 grid gap-3 rounded-[24px] border border-[var(--mk-line)] p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center md:gap-8">
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold">{t('Prefer to start with a few 3D dishes?')}</h3>
          <p className="mk-muted text-base leading-relaxed">{t('Choose the Menu website and add 3D to your best dishes, now or later.')}</p>
        </div>
        <p className="text-base font-medium tabular-nums md:text-right">
          {t('{standard} each · {bundleCount} for {bundlePrice} · {volumePrice} each from {volumeCount}', {
            standard: formatUsd(d.launch, locale), bundleCount: THREE_D_TIER_10, bundlePrice: formatUsd(d.from10Total, locale),
            volumePrice: formatUsd(d.from20Each, locale), volumeCount: THREE_D_TIER_20,
          })}
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
  { label: 'Changes done by our team', menu: '{count} / month', waiter: '{count} / month', payments: '{count} / month' },
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
  const { t } = usePublicLocale()
  const cls = `px-4 py-4 text-center border-b border-white/15 ${hl ? 'bg-white/5' : ''}`
  if (v === true) return <td className={cls}><Check className="mx-auto h-5 w-5" aria-label={t('Included')} /></td>
  if (v === false) return <td className={cls}><Minus className="mk-muted mx-auto h-5 w-5" aria-label={t('Not included')} /></td>
  return <td className={`${cls} text-base font-medium tabular-nums`}>{t(v, { count: CHANGES_PER_MONTH })}</td>
}

const PLAN_NAMES: Record<PlanKey, string> = { menu: 'Menu', waiter: 'Waiter', payments: 'Payments' }

function PlansSection() {
  const { locale, t } = usePublicLocale()
  const [yearly, setYearly] = useState(false)
  const keys: PlanKey[] = ['menu', 'waiter', 'payments']
  const summaries: Record<PlanKey, { lead: string; features: string[] }> = {
    menu: {
      lead: 'Your menu online, always up to date.',
      features: ['Hosting, support and your menu website', t('{count} changes a month done by our team', { count: CHANGES_PER_MONTH }), 'Dish analytics and the 3D viewer'],
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
  const price = (k: PlanKey) => formatUsd(yearly ? PLANS[k].yearly : PLANS[k].monthly, locale)
  const per = t(yearly ? 'per year' : 'per month')
  return (
    <section id="plans" aria-labelledby="monthly-title" className="mk-plans mk-dark mk-section scroll-mt-24">
      <div className="mk-container">
        <SectionHead id="monthly-title" step={t('Step 2 · Paid monthly')} title={t('Plan: we keep it running.')} lead={t('Hosting, support and changes by our team. Starts in month two. Begin with Menu and move up when you want ordering or payments.')} />
        <div role="group" aria-label={t('Billing period')} data-yearly={yearly} className="mk-billing-switch mb-8 grid w-fit max-w-full grid-cols-2 gap-1 rounded-[28px] border border-white/25 p-1">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className={seg}>{t('Monthly')}</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className={seg}>{t('Yearly · {count} months free', { count: YEARLY_FREE_MONTHS })}</button>
        </div>
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          {keys.map(key => (
            <article key={key} data-plan={key} className={`mk-plan-card grid min-w-0 content-start gap-4 rounded-[24px] border p-5 sm:gap-5 sm:p-8 ${key === 'waiter' ? 'border-white/50 bg-white/10' : 'border-white/25'}`}>
              <div className="grid gap-2">
                <h3 className="text-xl font-semibold">{t(PLAN_NAMES[key])}</h3>
                <p className="mk-muted text-base leading-relaxed">{t(summaries[key].lead)}</p>
              </div>
              <p>
                <strong className="mk-price text-4xl font-semibold"><span key={String(yearly)} className="mk-price-swap">{price(key)}</span></strong>
                <span className="mk-muted ml-2 text-base">{per}</span>
              </p>
              <Inc items={summaries[key].features} />
              <p className="mk-muted border-t border-white/20 pt-4 text-base leading-relaxed">
                {PLANS[key].paymentFeePercent
                  ? t('+ {percent}% per payment through Xprout. Stripe\'s processing fee is separate.', { percent: PLANS[key].paymentFeePercent })
                  : t('No fee on your sales.')}
              </p>
            </article>
          ))}
        </div>
        <details className="mk-comparison rounded-[24px] border border-white/25">
          <summary className={`cursor-pointer rounded-[24px] px-5 py-5 text-base font-medium sm:px-6 ${focus}`}>{t('Compare everything included')}</summary>
          <div className="px-3 pb-3 sm:px-5 sm:pb-5">
            <p className="mk-muted mb-3 text-base lg:hidden">{t('Scroll the comparison to see every plan.')}</p>
            <div className={`overflow-x-auto rounded-[24px] border border-white/25 ${focus}`} tabIndex={0} role="region" aria-label={t('Plan comparison, scrollable')}>
              <table className="w-full min-w-[720px] border-collapse text-base">
                <caption className="sr-only">{t(yearly ? 'Menu, Waiter and Payments plans, annual prices and included features' : 'Menu, Waiter and Payments plans, monthly prices and included features')}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="mk-muted w-[40%] px-5 py-8 text-left align-bottom text-base font-medium">{t('What is included')}</th>
                    {keys.map((k) => (
                      <th key={k} scope="col" className={`px-5 py-8 text-center align-top ${k === 'waiter' ? 'bg-white/5' : ''}`}>
                        <span className="block text-lg font-medium">{t(PLAN_NAMES[k])}</span>
                        <span className="mk-price mt-4 block text-3xl font-semibold"><span key={String(yearly)} className="mk-price-swap">{price(k)}</span></span>
                        <span className="mk-muted mt-2 block text-base font-normal">{per}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) =>
                    'group' in r ? (
                      <tr key={r.group}><th scope="colgroup" colSpan={4} className="border-y border-white/20 bg-white/5 px-5 py-4 text-left text-base font-semibold">{t(r.group)}</th></tr>
                    ) : (
                      <tr key={r.label}>
                        <th scope="row" className="border-b border-white/15 px-5 py-4 text-left font-normal">{t(r.label)}</th>
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
        <p className="mk-muted mt-6 max-w-3xl text-base leading-relaxed">{t('{count}-month minimum, then month to month.', { count: MIN_MONTHS })}</p>
      </div>
    </section>
  )
}

function ExtrasSection() {
  const { locale, t } = usePublicLocale()
  const a = ADDONS
  const each = (value: number) => t('{price} each', { price: formatUsd(value, locale) })
  const monthly = (value: number) => t('{price} / month', { price: formatUsd(value, locale) })
  const groups: Array<{ title: string; rows: Array<{ name: string; detail?: string; price: string }> }> = [
    {
      title: 'Paid once',
      rows: [
        { name: 'Extra language', price: each(a.extraLanguage.launch) },
        { name: '3D drink in its glass', price: each(a.threeDDrink.launch) },
        { name: 'Redo a 3D dish after a plating change', price: t('{percent}% of its price', { percent: a.redoThreeDPercent }) },
        { name: 'Extra change request', detail: t('Beyond the {count} included each month', { count: CHANGES_PER_MONTH }), price: each(a.extraChange.launch) },
      ],
    },
    {
      title: 'Added to your plan',
      rows: [
        { name: 'AI chat that answers guests', detail: t('Text and voice'), price: monthly(a.aiChat.monthly) },
        { name: 'Growth', detail: t('AI chat, monthly blog and SEO content, unlimited languages'), price: monthly(a.growth.monthly) },
        { name: 'Extra location', price: monthly(a.extraLocation.monthly) },
      ],
    },
  ]
  return (
    <section id="extras" aria-labelledby="extras-title" className="mk-container mk-section scroll-mt-24">
      <SectionHead id="extras-title" step={t('Optional')} title={t('Extras, only if you need them.')} />
      <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-2">
        {groups.map(group => (
          <div key={group.title} className="min-w-0">
            <h3 className="mk-eyebrow mb-2 border-b border-[var(--mk-line)] pb-4">{t(group.title)}</h3>
            <dl>
              {group.rows.map(row => (
                <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 border-b border-[var(--mk-line)] py-4">
                  <dt className="min-w-0 text-base font-medium">
                    {t(row.name)}
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
  const { locale, t, href } = usePublicLocale()
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
    <div className="flex justify-between gap-4"><span className="min-w-0">{name}</span><span className="shrink-0 tabular-nums">{formatUsd(v, locale)}</span></div>
  )

  return (
    <section id="estimate" aria-labelledby="estimate-title" className="mk-estimator mk-container mk-section scroll-mt-24">
      <SectionHead id="estimate-title" step={t('Optional')} title={t('Want an exact number?')} lead={t('Tell us about your menu and see what you would pay.')} />
      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <form className="mk-panel grid min-w-0 content-start gap-6 rounded-[24px] border border-[var(--mk-line)] p-5 sm:grid-cols-2 sm:p-8" onSubmit={(ev) => ev.preventDefault()} noValidate>
          <label htmlFor={`${uid}-items`} className={label}>{t('Dishes on your menu')}
            <input id={`${uid}-items`} className={field} type="number" inputMode="numeric" min={0} max={MAX_ITEMS} value={items} onChange={(ev) => setItems(ev.target.value)} />
            <span className={hint}>{t('{count} included, then {price} each.', { count: PROJECTS.we.includedItems, price: formatUsd(PROJECTS.we.extraItem.launch, locale) })}</span>
          </label>
          <label htmlFor={`${uid}-3d`} className={label}>{t('Of those, dishes in 3D')}
            <input id={`${uid}-3d`} className={field} type="number" inputMode="numeric" min={0} max={MAX_ITEMS} value={threeD} onChange={(ev) => setThreeD(ev.target.value)} />
            <span className={hint}>{t('{price} each, less from {count}.', { price: formatUsd(ADDONS.threeDDish.launch, locale), count: THREE_D_TIER_10 })}</span>
          </label>
          <label htmlFor={`${uid}-lang`} className={label}>{t('Extra languages')}
            <input id={`${uid}-lang`} className={field} type="number" inputMode="numeric" min={0} max={MAX_LANGUAGES} value={langs} onChange={(ev) => setLangs(ev.target.value)} />
            <span className={hint}>{t('2 are included.')}</span>
          </label>
          <label htmlFor={`${uid}-plan`} className={label}>{t('Plan')}
            <select id={`${uid}-plan`} className={field} value={plan} onChange={(ev) => setPlan(ev.target.value as PlanKey)}>
              <option value="menu">{t('{plan} · {price} / month', { plan: t(PLAN_NAMES.menu), price: formatUsd(PLANS.menu.monthly, locale) })}</option>
              <option value="waiter">{t('{plan} · {price} / month', { plan: t(PLAN_NAMES.waiter), price: formatUsd(PLANS.waiter.monthly, locale) })}</option>
              <option value="payments">{t('{plan} · {price} / month + {percent}%', { plan: t(PLAN_NAMES.payments), price: formatUsd(PLANS.payments.monthly, locale), percent: PLANS.payments.paymentFeePercent ?? 0 })}</option>
            </select>
          </label>
        </form>

        <div className="mk-estimate-result mk-dark grid min-w-0 content-start gap-6 rounded-[24px] p-5 sm:p-8" aria-live="polite" aria-atomic="true">
          <div className="grid gap-2">
            <p className="mk-eyebrow">{t('Setup · paid once')}</p>
            <p className="mk-price text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-none">{formatUsd(e.project, locale)}</p>
          </div>
          <div className="grid gap-3 border-t border-white/25 pt-4 text-base">
            {line(t('Menu website with {count} dishes', { count: PROJECTS.we.includedItems }), e.base)}
            {e.extraItems > 0 && line(t('More dishes'), e.extraItems)}
            {e.threeDCount > 0 && line(t(e.threeDCount === 1 ? '{count} dish in 3D' : '{count} dishes in 3D', { count: e.threeDCount }), e.threeD)}
            {e.languages > 0 && line(t('Extra languages'), e.languages)}
          </div>
          <div className="grid gap-2 border-t border-white/25 pt-4">
            <p className="mk-eyebrow">{t('Plan · paid monthly')}</p>
            <p className="text-base leading-relaxed">
              <strong className="mk-price text-3xl font-semibold">{formatUsd(e.monthly, locale)}</strong>
              <span className="mk-muted">{' '}{e.paymentFeePercent
                ? t('/ month from month two, plus {percent}% of payments through Xprout', { percent: e.paymentFeePercent })
                : t('/ month from month two')}</span>
            </p>
          </div>
          <a href={href(PRICING_CTA_HREF)} className={`${ctaBtn} mk-button--light w-full sm:w-fit`}>{t('Get started')}{' '}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
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
  const { t } = usePublicLocale()
  return (
    <section aria-labelledby="how-title" className="mk-container mk-section border-t border-[var(--mk-line)]">
      <SectionHead id="how-title" step={t('How it works')} title={t('From your kitchen to their screen.')} />
      <ol className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.t} className="grid grid-cols-[3rem_1fr] content-start gap-x-3 gap-y-2 border-t border-[var(--mk-line)] pt-5 sm:grid-cols-1 sm:gap-3 sm:pt-6">
            <span className="mk-price row-span-2 text-3xl font-medium sm:row-span-1 sm:mb-3" aria-hidden="true">0{i + 1}</span>
            <h3 className="text-lg font-semibold">{t(s.t)}</h3>
            <p className="mk-muted text-base leading-relaxed">{t(s.d)}</p>
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
  const { locale, t, href } = usePublicLocale()
  return (
    <div className="min-h-screen bg-[var(--mk-paper)] text-[var(--mk-ink)]">
      <Nav appName={appName} logoUrl={logoUrl} startHref={PRICING_CTA_HREF} activePage="pricing" />
      <main>
        <header className="mk-pricing-hero mk-container mk-section">
          <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
            <div className="grid gap-6">
              <span className="mk-eyebrow">{t('Pricing')}</span>
              <h1 className="mk-display max-w-3xl">{t('One setup.')}<br />{t('One monthly plan.')}</h1>
              <p className="mk-lead max-w-2xl">{t('We build your menu website, add your dishes and photos, and keep it up to date. You pay once for the setup, then a monthly plan.')}</p>
              <div className="flex flex-wrap gap-3">
                <a href={href(PRICING_CTA_HREF)} className={ctaBtn}>{t('Get started')}{' '}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                <a href="#estimate" className="mk-button mk-button--outline">{t('Estimate your price')}</a>
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
        <section className="mk-container grid gap-6 border-t border-[var(--mk-line)] py-12 sm:py-16" aria-label={t('Commercial terms')}>
          <p className="mk-eyebrow">{t('The details')}</p>
          <div className="mk-muted grid gap-4 text-base leading-relaxed md:grid-cols-2 md:gap-16">
            <p>{t('Launch prices are valid for our first {count} restaurants or until {date}, whichever comes first. Crossed-out prices are our regular prices. 3D is made for the dishes you choose; seeing a dish on the table needs a supported phone.', { count: LAUNCH_SLOTS, date: formatLaunchEnd(locale) })}</p>
            <p>{t('Setup paid {start}% to start and {launch}% at launch. Plans have a {months}-month minimum, then month to month. All prices in US dollars, before tax.', { start: PAYMENT_SPLIT.start, launch: PAYMENT_SPLIT.launch, months: MIN_MONTHS })}{' '}{t(NFC_NOTE)}</p>
          </div>
          <a href={href(PRICING_CTA_HREF)} className={`${ctaBtn} mt-2 w-fit max-w-full`}>{t('Get started')}{' '}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        </section>
      </main>
      <Footer data={footerData} appName={appName} logoUrl={logoUrl} />
    </div>
  )
}
