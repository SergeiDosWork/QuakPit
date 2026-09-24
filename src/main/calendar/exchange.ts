// On-premises Microsoft Exchange calendar provider (EWS / SOAP over HTTPS).
// Requests go straight from this Mac to the user's Exchange server: Basic auth
// first, automatic upgrade to NTLMv2 (httpntlm) when the server asks for it.
import { net } from 'electron'
import * as ntlm from 'httpntlm'
import { clearExchange, loadExchange, saveExchange } from '../store'
import {
  findItemError,
  findItemXml,
  normalizeServerUrl,
  parseFindItemResponse,
  pickAuthScheme,
  splitUsername
} from './ews'
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
      throw new Error('The Exchange server did not respond in time.')
    }
    throw new Error(
      'Cannot reach the Exchange server (network, VPN or untrusted certificate).'
    )
  }
  return { status: res.status, wwwAuthenticate: res.headers.get('www-authenticate'), text: await res.text() }
}

/** POST with a full NTLMv2 handshake (httpntlm drives the Node HTTP stack). */
async function postViaNtlm(c: ExchangeConfig, body: string): Promise<string> {
  const { username, domain } = splitUsername(c.username)
  return new Promise<string>((resolve, reject) => {
    ntlm.post(
      {
        url: c.serverUrl,
        username,
        password: c.password,
        domain,
        workstation: '',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body,
        timeout: TIMEOUT_MS
      },
      (err, r) => {
        if (err) {
          reject(
            new Error('Cannot reach the Exchange server (network, VPN or untrusted certificate).')
          )
        } else {
          resolve(r.body)
        }
      }
    )
  })
}

function describeStatus(status: number): string {
  if (status === 401) return 'The server rejected the login. Check your username and password.'
  if (status === 403) return 'Access denied — EWS may be disabled for your account by your administrator.'
  if (status === 404) return 'EWS not found at this address. Check the server address with IT.'
  return `Exchange error (${status}).`
}

function httpStatusError(res: RawResponse): Error {
  if (res.status === 401) {
    if (pickAuthScheme(res.wwwAuthenticate) === 'none') {
      return new Error('The server offered no supported login method (Basic or NTLM).')
    }
    return new Error('Wrong username, password or domain.')
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
    name: 'Exchange',
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
  const serverUrl = normalizeServerUrl(params.serverUrl ?? '')
  const username = (params.username ?? '').trim()
  const password = params.password ?? ''
  if (!username || !password) {
    throw new Error('Enter the server address, your username and your password.')
  }
  const candidate: ExchangeConfig = { serverUrl, username, password, auth: 'basic' }
  const now = Date.now()
  // A tiny FindItem validates the login, the endpoint and EWS availability.
  const probe = findItemXml(new Date(now).toISOString(), new Date(now + 60_000).toISOString(), 1)
  try {
    await postEws(candidate, probe)
  } catch {
    throw new Error(
      'Could not connect: check the server address, your username and password. ' +
        'If EWS is disabled by your administrator, Quakpit cannot read this calendar.'
    )
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
  return parseFindItemResponse(body)
    .filter((e) => e.start > now && e.start <= now + minutes * 60_000)
    .sort((a, b) => a.start - b.start)
}
