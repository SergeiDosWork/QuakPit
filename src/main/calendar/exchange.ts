// On-premises Microsoft Exchange calendar provider (EWS / SOAP over HTTPS).
// Requests go straight from this Mac to the user's Exchange server: Basic auth
// first, automatic upgrade to NTLMv2 (ntlm-http.ts) when the server asks for it.
import { net } from 'electron'
import { NtlmRedirectError, ntlmPost } from './ntlm-http'
import { clearExchange, loadExchange, saveExchange } from '../store'
import {
  findItemError,
  findItemXml,
  normalizeServerUrl,
  parseFindItemResponse,
  pickAuthScheme,
  splitUsername
} from './ews'
import { currentLocale, t } from '../i18n'
import type { ProviderStatus, UpcomingEvent } from './types'

const TIMEOUT_MS = 15_000

export type ExchangeConfig = {
  serverUrl: string // full EWS endpoint, https
  username: string // as typed: DOMAIN\user, user@domain or a plain name
  password: string
  auth: 'basic' | 'ntlm' // the scheme the server accepted
}

let creds: ExchangeConfig | null | undefined // undefined = not loaded yet

function loadCreds(): void {
  if (creds !== undefined) return
  const raw = loadExchange()
  try {
    creds = raw ? (JSON.parse(raw) as ExchangeConfig) : null
  } catch {
    creds = null
  }
}

// --- HTTP layer -------------------------------------------------------------

type RawResponse = { status: number; wwwAuthenticate: string | null; text: string }

/** POST via Chromium's stack — honours the macOS Keychain (corporate CAs). */
async function postBasic(c: ExchangeConfig, body: string): Promise<RawResponse> {
  let res: Response
  try {
    res = await net.fetch(c.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Authorization: 'Basic ' + Buffer.from(`${c.username}:${c.password}`).toString('base64')
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      throw new Error(t('exchange.timeout'))
    }
    throw new Error(t('exchange.unreachable'))
  }
  return { status: res.status, wwwAuthenticate: res.headers.get('www-authenticate'), text: await res.text() }
}

/** POST with a full NTLMv2 handshake. The handshake never follows redirects:
 * the credentials only ever travel to the exact https URL the user configured. */
async function postViaNtlm(c: ExchangeConfig, body: string): Promise<string> {
  const { username, domain } = splitUsername(c.username)
  try {
    const res = await ntlmPost({
      url: c.serverUrl,
      username,
      password: c.password,
      domain,
      workstation: '',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body,
      timeoutMs: TIMEOUT_MS
    })
    return res.body
  } catch (e) {
    if (e instanceof NtlmRedirectError) throw new Error(t('exchange.redirect'))
    if ((e as Error).name === 'TimeoutError') throw new Error(t('exchange.timeout'))
    throw new Error(t('exchange.unreachable'))
  }
}

function describeStatus(status: number): string {
  if (status === 401) return t('exchange.status401')
  if (status === 403) return t('exchange.status403')
  if (status === 404) return t('exchange.status404')
  return t('exchange.generic', { status })
}

function httpStatusError(res: RawResponse): Error {
  if (res.status === 401) {
    if (pickAuthScheme(res.wwwAuthenticate) === 'none') {
      return new Error(t('exchange.noAuthMethod'))
    }
    return new Error(t('exchange.wrongCreds'))
  }
  return new Error(describeStatus(res.status))
}

/** One authenticated POST, upgrading Basic → NTLM when the server demands it. */
async function postEws(c: ExchangeConfig, body: string): Promise<string> {
  if (c.auth === 'ntlm') return postViaNtlm(c, body)
  const res = await postBasic(c, body)
  if (res.status === 200) return res.text
  if (res.status === 401 && pickAuthScheme(res.wwwAuthenticate) === 'ntlm') {
    c.auth = 'ntlm' // remember the upgrade (persisted on success by the caller)
    return postViaNtlm(c, body)
  }
  throw httpStatusError(res)
}

function persist(c: ExchangeConfig): void {
  saveExchange(JSON.stringify(c))
}

// --- public API (same shape as icloud.ts) ------------------------------------

export function init(): void {
  loadCreds()
}

export function status(): ProviderStatus {
  loadCreds()
  return {
    id: 'exchange',
    name: t('calendar.exchange.name'),
    connected: !!creds,
    detail: creds?.username ?? null,
    configured: true
  }
}

export async function connect(params: {
  serverUrl?: string
  username?: string
  password?: string
}): Promise<void> {
  const serverUrl = normalizeServerUrl(params.serverUrl ?? '', currentLocale())
  const username = (params.username ?? '').trim()
  const password = params.password ?? ''
  if (!username || !password) {
    throw new Error(t('exchange.enterAll'))
  }
  const candidate: ExchangeConfig = { serverUrl, username, password, auth: 'basic' }
  const now = Date.now()
  // A tiny FindItem validates the login, the endpoint and EWS availability.
  const probe = findItemXml(new Date(now).toISOString(), new Date(now + 60_000).toISOString(), 1)
  try {
    await postEws(candidate, probe)
  } catch {
    throw new Error(t('exchange.connectFailed'))
  }
  creds = candidate
  persist(creds)
}

export function disconnect(): void {
  creds = null
  clearExchange()
}

/** Events starting within the next `minutes`. In memory only, never persisted. */
export async function listUpcoming(minutes = 60): Promise<UpcomingEvent[]> {
  loadCreds()
  if (!creds) return []
  const now = Date.now()
  const xml = findItemXml(new Date(now).toISOString(), new Date(now + minutes * 60_000).toISOString())
  const wasNtlm = creds.auth === 'ntlm'
  const body = await postEws(creds, xml)
  if (!wasNtlm && creds.auth === 'ntlm') persist(creds) // the NTLM upgrade worked — save it once
  const err = findItemError(body)
  if (err) throw new Error(err)
  return parseFindItemResponse(body, currentLocale())
    .filter((e) => e.start > now && e.start <= now + minutes * 60_000)
    .sort((a, b) => a.start - b.start)
}
