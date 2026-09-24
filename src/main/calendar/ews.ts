// Pure EWS helpers (no Electron/network imports) — unit-testable via ews.test.ts.
// Exchange on-premises exposes its calendar over SOAP ("Exchange Web Services"):
// a FindItem request with a CalendarView against the distinguished "calendar" folder.

export type ExchangeEvent = { id: string; title: string; start: number }

const EWS_PATH = '/EWS/Exchange.asmx'

/** Normalizes whatever the user typed into a full EWS endpoint URL (https only). */
export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Enter your Exchange server address.')
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error('That does not look like a server address.')
  }
  if (url.protocol !== 'https:') {
    throw new Error('Use an https:// address — your password is sent to this server.')
  }
  if (/exchange\.asmx\/?$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/$/, '')
  } else {
    url.pathname = url.pathname.replace(/\/$/, '') + EWS_PATH
  }
  return url.toString()
}

/** Chooses an auth scheme from the WWW-Authenticate challenge header(s). */
export function pickAuthScheme(wwwAuthenticate: string | null): 'basic' | 'ntlm' | 'none' {
  const offered = (wwwAuthenticate ?? '').toLowerCase()
  if (/\bbasic\b/.test(offered)) return 'basic' // simplest path when allowed
  if (/\b(ntlm|negotiate)\b/.test(offered)) return 'ntlm'
  return 'none'
}

/** Splits a Windows login into the NTLM parts. Accepts DOMAIN\user, user@domain, user. */
export function splitUsername(raw: string): { username: string; domain: string } {
  const value = raw.trim()
  const backslash = value.indexOf('\\')
  if (backslash > 0 && backslash < value.length - 1) {
    return { username: value.slice(backslash + 1), domain: value.slice(0, backslash) }
  }
  return { username: value, domain: '' }
}

/** SOAP FindItem + CalendarView request for the default calendar folder. */
export function findItemXml(startIso: string, endIso: string, max = 50): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"
    xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2007_SP1" />
  </soap:Header>
  <soap:Body>
    <m:FindItem Traversal="Shallow">
      <m:ItemShape>
        <t:BaseShape>IdOnly</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject" />
          <t:FieldURI FieldURI="calendar:Start" />
          <t:FieldURI FieldURI="calendar:End" />
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:CalendarView MaxEntriesReturned="${max}" StartDate="${startIso}" EndDate="${endIso}" />
      <m:ParentFolderIds>
        <t:DistinguishedFolderId Id="calendar" />
      </m:ParentFolderIds>
    </m:FindItem>
  </soap:Body>
</soap:Envelope>`
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#13;/g, '\r')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
}

/** First <…tag…>…</…tag…> block (namespace-agnostic), as in icloud.ts. */
function insideTag(xml: string, tag: string): string | null {
  const block = new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)</[^>]*:?${tag}>`, 'i').exec(xml)
  return block ? block[1] : null
}

/** Extracts upcoming calendar items from a FindItem + CalendarView response. */
export function parseFindItemResponse(xml: string): ExchangeEvent[] {
  const events: ExchangeEvent[] = []
  const re = /<[^>]*:?CalendarItem[^>]*>([\s\S]*?)<\/[^>]*:?CalendarItem>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const block = m[1]
    const id = /<[^>]*:?ItemId[^>]*\bId="([^"]+)"/i.exec(block)?.[1]
    const start = insideTag(block, 'Start')
    if (!id || !start) continue
    const ts = Date.parse(decodeEntities(start.trim()))
    if (Number.isNaN(ts)) continue
    const subject = insideTag(block, 'Subject')
    const title = subject ? decodeEntities(subject.trim()) : 'Untitled event'
    events.push({ id: `exchange:${id}`, title, start: ts })
  }
  return events
}

/** The MessageText of an error response, or null when the request succeeded. */
export function findItemError(xml: string): string | null {
  const text = insideTag(xml, 'MessageText')
  if (!text) return null
  return decodeEntities(text.trim())
}
