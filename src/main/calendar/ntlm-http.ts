// HTTP driver for the NTLM handshake, replacing httpntlm's httpreq wrapper.
// The wrapper followed Location redirects by restarting the whole handshake on
// the redirect target — an attacker-controlled or misconfigured server could
// redirect the type 3 (credential) message to another host, or downgrade to
// plain http://. Here a redirect is terminal: the handshake only ever talks to
// the exact https URL the user configured. Type 1 and type 3 messages ride one
// keep-alive socket, as the NTLM protocol expects.

import { Agent as HttpAgent, request as httpRequest } from 'node:http'
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https'
import {
  createType1Message,
  createType3Message,
  parseType2Message,
  type NtlmCredentials,
  type Type2Message
} from './ntlm'

export type NtlmPostOptions = NtlmCredentials & {
  url: string
  body?: string
  headers?: Record<string, string>
  timeoutMs?: number
  /** Caller-provided array — every handshake step is appended for diagnostics. */
  trace?: string[]
}

export type NtlmPostResult = { status: number; body: string }

/** Thrown when the server answers the handshake with a redirect. */
export class NtlmRedirectError extends Error {}

/** Thrown when the handshake ends on a non-200 response (e.g. 401 = the
 * server rejected the credentials, 503 = unavailable). Carries the HTTP
 * status so callers can show an accurate, localized message. */
export class NtlmHandshakeError extends Error {
  constructor(readonly status: number) {
    super(`NTLM handshake failed with status ${status}`)
  }
}

type RawResponse = { status: number; wwwAuthenticate: string | null; location: string | null; body: string }

function send(
  url: URL,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
  agent: HttpAgent
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const options = {
      method: 'POST' as const,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers,
      agent,
      signal: AbortSignal.timeout(timeoutMs)
    }
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const wwwAuthenticate = res.headers['www-authenticate']
        resolve({
          status: res.statusCode ?? 0,
          wwwAuthenticate: Array.isArray(wwwAuthenticate) ? wwwAuthenticate.join(', ') : (wwwAuthenticate ?? null),
          location: typeof res.headers.location === 'string' ? res.headers.location : null,
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
    })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

/** Host + path of a redirect target — the query string is dropped so tokens
 * another server might have embedded in it are never echoed into the trace. */
function safeLocation(location: string): string {
  try {
    const u = new URL(location, 'https://placeholder.invalid')
    return u.host ? u.origin + u.pathname : u.pathname
  } catch {
    return '<unparseable>'
  }
}

/** One technical line about a failed handshake step, for the caller's trace. */
function networkLine(step: string, e: unknown, timeoutMs: number): string {
  const err = e as Error & { code?: string; cause?: { code?: string; message?: string } }
  const kind = err.name === 'TimeoutError' ? `timeout after ${timeoutMs}ms` : (err.code ?? err.cause?.code ?? err.name)
  const cause = err.cause?.message ? ` — ${err.cause.message}` : ''
  return `NTLM ${step} → network error (${kind}): ${err.message}${cause}`
}

/** One full NTLM handshake + authenticated POST. Never follows redirects. */
export async function ntlmPost(options: NtlmPostOptions): Promise<NtlmPostResult> {
  const url = new URL(options.url)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`unsupported protocol: ${url.protocol}`)
  }
  const timeoutMs = options.timeoutMs ?? 15_000
  // One single-slot keep-alive agent: the type 3 message must reuse the same
  // socket the type 1 message went out on. The agent must match the URL's
  // protocol — Node throws `Protocol "https:" not supported` when an http.Agent
  // is handed to an https request.
  const agent =
    url.protocol === 'https:'
      ? new HttpsAgent({ keepAlive: true, maxSockets: 1 })
      : new HttpAgent({ keepAlive: true, maxSockets: 1 })
  const trace = options.trace ?? []

  try {
    const baseHeaders: Record<string, string> = { Connection: 'keep-alive', ...(options.headers ?? {}) }
    delete baseHeaders.Authorization

    let type1: RawResponse
    try {
      type1 = await send(url, { ...baseHeaders, Authorization: createType1Message(options) }, undefined, timeoutMs, agent)
    } catch (e) {
      trace.push(networkLine('type1', e, timeoutMs))
      throw e
    }
    if (type1.location) {
      trace.push(`NTLM type1 → server redirect to ${safeLocation(type1.location)}`)
      throw new NtlmRedirectError(`server tried to redirect the NTLM handshake to ${type1.location}`)
    }
    trace.push(`NTLM type1 → HTTP ${type1.status}`)
    if (type1.status === 200) return { status: type1.status, body: type1.body }
    if (type1.status !== 401) {
      throw new NtlmHandshakeError(type1.status)
    }

    const msg2: Type2Message = parseType2Message(type1.wwwAuthenticate ?? '')
    trace.push(
      `NTLM challenge: flags 0x${msg2.negotiateFlags.toString(16)}, targetInfo ${
        msg2.targetInfo ? `${msg2.targetInfo.length} bytes` : 'absent'
      }`
    )

    let type3: RawResponse
    try {
      type3 = await send(url, { ...baseHeaders, Authorization: createType3Message(msg2, options) }, options.body, timeoutMs, agent)
    } catch (e) {
      trace.push(networkLine('type3', e, timeoutMs))
      throw e
    }
    if (type3.location) {
      trace.push(`NTLM type3 → server redirect to ${safeLocation(type3.location)}`)
      throw new NtlmRedirectError(`server tried to redirect the authenticated request to ${type3.location}`)
    }
    trace.push(`NTLM type3 → HTTP ${type3.status}`)
    if (type3.status !== 200) {
      throw new NtlmHandshakeError(type3.status)
    }
    return { status: type3.status, body: type3.body }
  } finally {
    agent.destroy()
  }
}
