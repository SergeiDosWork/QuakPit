import { randomUUID } from 'node:crypto'
import ICAL from 'ical.js'
import { loadIcalFeeds, saveIcalFeeds } from '../store'
import { normalizeFeedUrl, readBodyWithLimit, FeedUrlError } from './net-guard'
import { t, tPlural } from '../i18n'
import type { ProviderStatus, UpcomingEvent } from './types'

export type Feed = { id: string; name: string; url: string }

const FETCH_TIMEOUT_MS = 15_000
const MAX_FEED_BYTES = 10 * 1024 * 1024

let feeds: Feed[] | undefined // undefined = not loaded yet

function load(): Feed[] {
  if (feeds) return feeds
  const raw = loadIcalFeeds()
  try {
    feeds = raw ? (JSON.parse(raw) as Feed[]) : []
  } catch {
    feeds = []
  }
  return feeds
}

function persist(): void {
  saveIcalFeeds(JSON.stringify(load()))
}

/** Accepts https and webcal:// links; returns the .ics text (and validates it).
 * Plain http:// is refused (MITM could forge meeting reminders), redirects may
 * only land back on https, and the response is size-capped. */
async function fetchFeed(url: string): Promise<string> {
  let normalized: string
  try {
    normalized = normalizeFeedUrl(url)
  } catch (e) {
    throw new Error(t((e as FeedUrlError).reason === 'insecure' ? 'ical.httpsOnly' : 'ical.invalidLink'))
  }
  const res = await fetch(normalized, {
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(t('ical.fetchFailed', { status: res.status }))
  if (!res.url.startsWith('https://')) throw new Error(t('ical.httpsOnly'))
  const text = await readBodyWithLimit(res, MAX_FEED_BYTES)
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error(t('ical.notIcal'))
  return text
}

function collect(ics: string, nowMs: number, endMs: number, out: UpcomingEvent[]): void {
  let comp: ICAL.Component
  try {
    comp = new ICAL.Component(ICAL.parse(ics))
  } catch {
    return
  }
  for (const ve of comp.getAllSubcomponents('vevent')) {
    try {
      const ev = new ICAL.Event(ve)
      if (!ev.startDate || ev.startDate.isDate) continue // skip all-day
      const title = ev.summary || t('event.untitled')
      const uid = ev.uid || ''
      if (ev.isRecurring()) {
        const it = ev.iterator()
        let next = it.next()
        let guard = 0
        while (next && guard++ < 1000) {
          const t = next.toJSDate().getTime()
          if (t > endMs) break
          if (t >= nowMs) out.push({ id: `ical:${uid}:${t}`, title, start: t })
          next = it.next()
        }
      } else {
        const t = ev.startDate.toJSDate().getTime()
        out.push({ id: `ical:${uid}:${t}`, title, start: t })
      }
    } catch {
      /* skip this event */
    }
  }
}

// --- public API ------------------------------------------------------------

export function init(): void {
  load()
}

export function status(): ProviderStatus {
  const n = load().length
  return {
    id: 'ical',
    name: t('calendar.ical.name'),
    connected: n > 0,
    detail: n ? tPlural('ical.feeds', n) : null,
    configured: true
  }
}

export function listFeeds(): Feed[] {
  return load().map((f) => ({ ...f }))
}

export async function addFeed(url: string, name?: string): Promise<Feed[]> {
  const ics = await fetchFeed(url) // validates the link
  let nm = (name ?? '').trim()
  if (!nm) {
    const m = /X-WR-CALNAME:(.+)/i.exec(ics)
    nm = m ? m[1].trim().slice(0, 60) : t('ical.fallbackName')
  }
  const list = load()
  list.push({ id: randomUUID(), name: nm, url: url.trim() })
  feeds = list
  persist()
  return listFeeds()
}

export function removeFeed(id: string): Feed[] {
  feeds = load().filter((f) => f.id !== id)
  persist()
  return listFeeds()
}

/** Events starting within the next `minutes`, across all feeds. In memory only. */
export async function listUpcoming(minutes = 60): Promise<UpcomingEvent[]> {
  const list = load()
  if (!list.length) return []
  const nowMs = Date.now()
  const endMs = nowMs + minutes * 60_000
  const out: UpcomingEvent[] = []
  await Promise.all(
    list.map(async (feed) => {
      try {
        collect(await fetchFeed(feed.url), nowMs, endMs, out)
      } catch {
        /* skip this feed */
      }
    })
  )
  return out.filter((e) => e.start > nowMs && e.start <= endMs).sort((a, b) => a.start - b.start)
}
