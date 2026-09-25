// Pure guards for the outbound calendar requests: URL policies and a bounded
// response read. Kept free of Electron/network imports so they unit-test
// directly (net-guard.test.ts).

/** iCal feeds: webcal:// rewrites to https://, everything else must be https.
 * A plain http:// feed would let any network observer forge meeting reminders. */
export class FeedUrlError extends Error {
  readonly reason: 'invalid' | 'insecure'
  constructor(reason: 'invalid' | 'insecure', message: string) {
    super(message)
    this.reason = reason
  }
}

export function normalizeFeedUrl(raw: string): string {
  const normalized = raw.trim().replace(/^webcal:\/\//i, 'https://')
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new FeedUrlError('invalid', 'not a valid calendar link')
  }
  if (url.protocol !== 'https:') {
    throw new FeedUrlError('insecure', 'iCal feeds must use https://')
  }
  return url.toString()
}

/** CalDAV: Basic credentials must only travel to icloud.com hosts over https. */
export function isTrustedIcloudUrl(url: string | URL): boolean {
  try {
    const parsed = typeof url === 'string' ? new URL(url) : url
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.icloud.com')
  } catch {
    return false
  }
}

/** Reads a Response body as text with a hard size cap: content-length is
 * checked up-front, and the stream itself is abandoned as soon as it overruns
 * (a hostile feed cannot balloon memory). */
export async function readBodyWithLimit(res: Response, maxBytes: number): Promise<string> {
  const declared = res.headers.get('content-length')
  if (declared && Number(declared) > maxBytes) throw new Error('calendar response is too large')
  if (!res.body) return ''

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel()
      throw new Error('calendar response is too large')
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}
