'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, ExternalLink, Globe, Plus, Trash2, Upload } from 'lucide-react'
import { compressImageForUpload } from '@/lib/media/client-compress'
import { blankSection, SECTION_LABELS, SECTION_TYPES, type PageSection, type SectionType } from '@/lib/pages/sections'
import { slugFromTitle } from '@/lib/pages/page-rules'
import { localPageTemplate, type LocalPageTemplate } from '@/lib/pages/local-templates'

type PageRow = { id: string; slug: string; title: string; is_published: boolean; show_in_nav: boolean; section_count: number }
type Submission = { id: string; page_id: string; page_title: string; name: string; email: string; phone: string | null; message: string; created_at: string }
type Draft = { id: string | null; title: string; slug: string; description: string; isPublished: boolean; showInNav: boolean; sections: PageSection[]; slugTouched: boolean }

const input = 'w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-950 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary'
const label = 'block text-[14px] font-semibold text-zinc-700 mb-1.5 ml-1'
const card = 'bg-white border border-zinc-100 rounded-[1.25rem] shadow-sm'
const quiet = 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40'
const primary = 'inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50'

const emptyDraft = (): Draft => ({ id: null, title: '', slug: '', description: '', isPublished: false, showInNav: true, sections: [], slugTouched: false })

/** Moves item `index` one step; unchanged at the ends. */
function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  if (to < 0 || to >= items.length) return [...items]
  const next = [...items]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong')
  return body
}

/** Same pipeline and budgets as dish photos: the browser shrinks it, the server converts to WebP within the byte cap. */
async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', await compressImageForUpload(file))
  const response = await fetch('/api/admin/products/upload', { method: 'POST', body: form })
  const body = await response.json().catch(() => null) as { url?: string; error?: string } | null
  if (!response.ok || !body?.url) throw new Error(body?.error ?? 'Photo upload failed')
  return body.url
}

function ImageField({ value, onChange, onError }: { value?: string; onChange: (url: string | undefined) => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-center gap-3">
      {value && /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt="" className="size-16 rounded-xl object-cover" />}
      <label className={`${quiet} cursor-pointer`}>
        <Upload className="size-3.5" /> {busy ? 'Uploading...' : value ? 'Replace image' : 'Add image'}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={async event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          try { onChange(await uploadImage(file)) } catch (err) { onError(err instanceof Error ? err.message : 'Photo upload failed') }
          setBusy(false)
        }} />
      </label>
      {value && <button type="button" className={quiet} onClick={() => onChange(undefined)}>Remove</button>}
    </div>
  )
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return <label className="block"><span className={label}>{name}</span>{children}</label>
}

function SectionEditor({ section, onChange, onError }: { section: PageSection; onChange: (next: PageSection) => void; onError: (message: string) => void }) {
  const set = (patch: Record<string, unknown>) => onChange({ ...section, ...patch } as PageSection)
  const heading = <Field name="Heading (optional)"><input className={input} maxLength={120} value={section.heading ?? ''} onChange={e => set({ heading: e.target.value })} /></Field>
  switch (section.type) {
    case 'text_image':
      return (
        <div className="space-y-4">
          {heading}
          <Field name="Text (a blank line starts a new paragraph)"><textarea className={input} rows={6} maxLength={5000} value={section.body} onChange={e => set({ body: e.target.value })} /></Field>
          <ImageField value={section.image} onChange={image => set({ image })} onError={onError} />
          <Field name="Image side">
            <select className={input} value={section.imageSide} onChange={e => set({ imageSide: e.target.value })}>
              <option value="right">Right</option><option value="left">Left</option>
            </select>
          </Field>
        </div>
      )
    case 'cards':
      return (
        <div className="space-y-4">
          {heading}
          {section.items.map((item, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <ImageField value={item.image} onChange={image => set({ items: section.items.map((it, i) => (i === index ? { ...it, image } : it)) })} onError={onError} />
              <Field name="Title"><input className={input} maxLength={120} value={item.title} onChange={e => set({ items: section.items.map((it, i) => (i === index ? { ...it, title: e.target.value } : it)) })} /></Field>
              <Field name="Subtitle (optional)"><input className={input} maxLength={160} value={item.subtitle ?? ''} onChange={e => set({ items: section.items.map((it, i) => (i === index ? { ...it, subtitle: e.target.value } : it)) })} /></Field>
              <Field name="Text (optional)"><textarea className={input} rows={3} maxLength={600} value={item.text ?? ''} onChange={e => set({ items: section.items.map((it, i) => (i === index ? { ...it, text: e.target.value } : it)) })} /></Field>
              <div className="flex gap-2">
                <button type="button" className={quiet} disabled={index === 0} onClick={() => set({ items: moveItem(section.items, index, -1) })}><ArrowUp className="size-3.5" /> Up</button>
                <button type="button" className={quiet} disabled={index === section.items.length - 1} onClick={() => set({ items: moveItem(section.items, index, 1) })}><ArrowDown className="size-3.5" /> Down</button>
                <button type="button" className={quiet} onClick={() => set({ items: section.items.filter((_, i) => i !== index) })}><Trash2 className="size-3.5" /> Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className={quiet} disabled={section.items.length >= 24} onClick={() => set({ items: [...section.items, { title: '' }] })}><Plus className="size-3.5" /> Add card</button>
        </div>
      )
    case 'faq':
      return (
        <div className="space-y-4">
          {heading}
          {section.items.map((item, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <Field name="Question"><input className={input} maxLength={200} value={item.question} onChange={e => set({ items: section.items.map((it, i) => (i === index ? { ...it, question: e.target.value } : it)) })} /></Field>
              <Field name="Answer"><textarea className={input} rows={3} maxLength={2000} value={item.answer} onChange={e => set({ items: section.items.map((it, i) => (i === index ? { ...it, answer: e.target.value } : it)) })} /></Field>
              <div className="flex gap-2">
                <button type="button" className={quiet} disabled={index === 0} onClick={() => set({ items: moveItem(section.items, index, -1) })}><ArrowUp className="size-3.5" /> Up</button>
                <button type="button" className={quiet} disabled={index === section.items.length - 1} onClick={() => set({ items: moveItem(section.items, index, 1) })}><ArrowDown className="size-3.5" /> Down</button>
                <button type="button" className={quiet} onClick={() => set({ items: section.items.filter((_, i) => i !== index) })}><Trash2 className="size-3.5" /> Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className={quiet} disabled={section.items.length >= 30} onClick={() => set({ items: [...section.items, { question: '', answer: '' }] })}><Plus className="size-3.5" /> Add question</button>
        </div>
      )
    case 'locations':
      return <div className="space-y-4">{heading}<p className="text-sm font-medium text-zinc-500">Filled in automatically from your locations and business hours (address, hours, map link and a button to the menu).</p></div>
    case 'contact_form':
      return (
        <div className="space-y-4">
          {heading}
          <Field name="Intro (optional)"><textarea className={input} rows={3} maxLength={600} value={section.intro ?? ''} onChange={e => set({ intro: e.target.value })} /></Field>
          <Field name="Email messages to (optional)"><input type="email" className={input} maxLength={254} value={section.notifyEmail ?? ''} onChange={e => set({ notifyEmail: e.target.value })} /></Field>
          <p className="text-sm font-medium text-zinc-500">Fields: name, email, phone (optional) and message. Every message is listed under Messages, whether or not an email is sent.</p>
        </div>
      )
    case 'button_link':
      return (
        <div className="space-y-4">
          {heading}
          <Field name="Text (optional)"><textarea className={input} rows={3} maxLength={600} value={section.text ?? ''} onChange={e => set({ text: e.target.value })} /></Field>
          <Field name="Button label"><input className={input} maxLength={60} value={section.label} onChange={e => set({ label: e.target.value })} /></Field>
          <Field name="Link (https only)"><input type="url" className={input} maxLength={500} placeholder="https://" value={section.url} onChange={e => set({ url: e.target.value })} /></Field>
        </div>
      )
  }
}

export default function WebsiteClient({ tenantSlug, tenantName = tenantSlug, available }: { tenantSlug: string; tenantName?: string; available: boolean }) {
  const [pages, setPages] = useState<PageRow[]>([])
  const [ready, setReady] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tab, setTab] = useState<'pages' | 'messages'>('pages')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!available) { setLoaded(true); return }
    try {
      const result = await call<{ ready: boolean; pages: PageRow[] }>('/api/admin/pages')
      setPages(result.pages)
      setReady(result.ready)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load pages') }
    setLoaded(true)
  }, [available])
  useEffect(() => { void load() }, [load])

  async function loadMessages() {
    setTab('messages')
    setError(null)
    try { setSubmissions((await call<{ submissions: Submission[] }>('/api/admin/pages/submissions')).submissions) } catch (err) { setError(err instanceof Error ? err.message : 'Could not load messages') }
  }

  async function edit(id: string) {
    setError(null)
    try {
      const { page } = await call<{ page: { id: string; title: string; slug: string; description: string; is_published: boolean; show_in_nav: boolean; sections: PageSection[] } }>(`/api/admin/pages/${id}`)
      setDraft({ id: page.id, title: page.title, slug: page.slug, description: page.description, isPublished: page.is_published, showInNav: page.show_in_nav, sections: page.sections, slugTouched: true })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open the page') }
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const body = JSON.stringify({ title: draft.title, slug: draft.slug, description: draft.description, isPublished: draft.isPublished, showInNav: draft.showInNav, sections: draft.sections })
      await call(draft.id ? `/api/admin/pages/${draft.id}` : '/api/admin/pages', { method: draft.id ? 'PUT' : 'POST', body })
      setDraft(null)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save') }
    setSaving(false)
  }

  async function act(id: string, init: RequestInit) {
    setError(null)
    try { await call(`/api/admin/pages/${id}`, init); await load() } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') }
  }

  const update = (patch: Partial<Draft>) => setDraft(current => (current ? { ...current, ...patch } : current))

  return (
    <div className="p-8 w-full space-y-8 max-w-3xl">
      <div className="pb-6 border-b border-zinc-100">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-5 h-5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Website</span>
        </div>
        <h1 className="text-4xl font-black text-zinc-950 tracking-tight">Website pages</h1>
        <p className="text-sm font-bold text-zinc-500 mt-1">Team, story, catering, careers, FAQ: build pages from text, cards, questions, locations, a contact form and button links.</p>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</p>
      )}

      {loaded && (!available || !ready) && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">Website pages will be available after the next update.</p>
      )}

      {loaded && available && ready && !draft && (
        <>
          <div className="flex gap-2" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'pages'} className={tab === 'pages' ? primary : quiet} onClick={() => setTab('pages')}>Pages</button>
            <button type="button" role="tab" aria-selected={tab === 'messages'} className={tab === 'messages' ? primary : quiet} onClick={() => void loadMessages()}>Messages</button>
          </div>

          {tab === 'pages' && (
            <>
              <button type="button" className={primary} onClick={() => { setError(null); setDraft(emptyDraft()) }}><Plus className="w-4 h-4" /> New page</button>
              <label className="flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-700">
                Start from a template
                <select className={`${input} max-w-xs`} defaultValue="" onChange={event => {
                  const kind = event.target.value as LocalPageTemplate
                  if (!kind) return
                  const template = localPageTemplate(kind, { restaurantName: tenantName })
                  setError(null)
                  setDraft({ ...emptyDraft(), title: template.title, slug: kind === 'locations' ? 'location-hours' : kind,
                    sections: template.sections, slugTouched: true })
                }}>
                  <option value="" disabled>Choose a starting point</option>
                  <option value="locations">Locations and hours</option>
                  <option value="catering">Catering</option>
                  <option value="private-events">Private events</option>
                  <option value="faq">Questions and answers</option>
                </select>
              </label>
              <div className={`${card} divide-y divide-zinc-100`}>
                {pages.length === 0 && <p className="p-8 text-sm font-medium text-zinc-500">No pages yet.</p>}
                {pages.map((page, index) => (
                  <div key={page.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-zinc-950">{page.title}</p>
                      <p className="truncate text-xs font-medium text-zinc-500">/{page.slug} · {page.section_count} {page.section_count === 1 ? 'section' : 'sections'}</p>
                      <p className="mt-1 flex gap-2 text-[11px] font-black uppercase tracking-wider">
                        <span className={page.is_published ? 'text-emerald-700' : 'text-zinc-500'}>{page.is_published ? 'Published' : 'Draft'}</span>
                        {page.show_in_nav && <span className="text-zinc-500">In menu</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={quiet} aria-label={`Move ${page.title} up`} disabled={index === 0} onClick={() => void act(page.id, { method: 'PATCH', body: JSON.stringify({ move: 'up' }) })}><ArrowUp className="size-3.5" /></button>
                      <button type="button" className={quiet} aria-label={`Move ${page.title} down`} disabled={index === pages.length - 1} onClick={() => void act(page.id, { method: 'PATCH', body: JSON.stringify({ move: 'down' }) })}><ArrowDown className="size-3.5" /></button>
                      {page.is_published
                        ? <a className={quiet} href={`/${tenantSlug}/${page.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /> View</a>
                        : <span className="text-xs font-medium text-zinc-400">Publish to preview</span>}
                      <button type="button" className={quiet} onClick={() => void edit(page.id)}>Edit</button>
                      <button type="button" className={quiet} onClick={() => { if (window.confirm(`Delete "${page.title}"? This cannot be undone.`)) void act(page.id, { method: 'DELETE' }) }}><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'messages' && (
            <div className={`${card} divide-y divide-zinc-100`}>
              {submissions.length === 0 && <p className="p-8 text-sm font-medium text-zinc-500">No messages yet.</p>}
              {submissions.map(item => (
                <div key={item.id} className="space-y-1 p-5">
                  <p className="text-xs font-medium text-zinc-500">{item.page_title} · {new Date(item.created_at).toLocaleString()}</p>
                  <p className="text-base font-bold text-zinc-950">{item.name} <a className="text-sm font-medium text-zinc-600 underline" href={`mailto:${item.email}`}>{item.email}</a>{item.phone ? <span className="text-sm font-medium text-zinc-600"> · {item.phone}</span> : null}</p>
                  <p className="whitespace-pre-line text-sm text-zinc-700">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="space-y-6">
          <div className={`${card} space-y-4 p-8`}>
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">{draft.id ? 'Edit page' : 'New page'}</h2>
            <Field name="Title"><input className={input} maxLength={120} value={draft.title} onChange={e => update({ title: e.target.value, ...(draft.slugTouched ? {} : { slug: slugFromTitle(e.target.value) }) })} /></Field>
            <Field name="Address"><input className={input} maxLength={60} value={draft.slug} onChange={e => update({ slug: e.target.value.toLowerCase(), slugTouched: true })} /></Field>
            <p className="-mt-2 ml-1 text-xs font-medium text-zinc-500">/{tenantSlug}/{draft.slug || 'address'}</p>
            <Field name="Description for search engines (optional)"><textarea className={input} rows={2} maxLength={300} value={draft.description} onChange={e => update({ description: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700"><input type="checkbox" checked={draft.isPublished} onChange={e => update({ isPublished: e.target.checked })} /> Published</label>
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700"><input type="checkbox" checked={draft.showInNav} onChange={e => update({ showInNav: e.target.checked })} /> Show in the menu links</label>
          </div>

          {draft.sections.map((section, index) => (
            <div key={section.id} className={`${card} space-y-4 p-8`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-black text-zinc-950">{index + 1}. {SECTION_LABELS[section.type]}</h3>
                <div className="flex gap-2">
                  <button type="button" className={quiet} aria-label="Move section up" disabled={index === 0} onClick={() => update({ sections: moveItem(draft.sections, index, -1) })}><ArrowUp className="size-3.5" /></button>
                  <button type="button" className={quiet} aria-label="Move section down" disabled={index === draft.sections.length - 1} onClick={() => update({ sections: moveItem(draft.sections, index, 1) })}><ArrowDown className="size-3.5" /></button>
                  <button type="button" className={quiet} aria-label="Delete section" onClick={() => update({ sections: draft.sections.filter((_, i) => i !== index) })}><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <SectionEditor section={section} onError={setError} onChange={next => update({ sections: draft.sections.map((current, i) => (i === index ? next : current)) })} />
            </div>
          ))}

          <div className={`${card} space-y-3 p-8`}>
            <h3 className="text-base font-black text-zinc-950">Add a section</h3>
            <div className="flex flex-wrap gap-2">
              {SECTION_TYPES.map((type: SectionType) => (
                <button key={type} type="button" className={quiet} disabled={draft.sections.length >= 40} onClick={() => update({ sections: [...draft.sections, blankSection(type)] })}><Plus className="size-3.5" /> {SECTION_LABELS[type]}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" className={primary} disabled={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save page'}</button>
            <button type="button" className={quiet} disabled={saving} onClick={() => { setDraft(null); setError(null) }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
