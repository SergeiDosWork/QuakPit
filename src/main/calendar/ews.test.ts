import { describe, expect, it } from 'vitest'
import {
  findItemError,
  findItemXml,
  normalizeServerUrl,
  parseFindItemResponse,
  pickAuthScheme,
  splitUsername
} from './ews'

// Minimal FindItem response fixture, modelled after the Microsoft Learn example:
// https://learn.microsoft.com/en-us/exchange/client-developer/exchange-web-services/how-to-get-appointments-and-meetings-by-using-ews-in-exchange
const SUCCESS_XML = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="https://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:FindItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"
        xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
      <m:ResponseMessages>
        <m:FindItemResponseMessage ResponseClass="Success">
          <m:ResponseCode>NoError</m:ResponseCode>
          <m:RootFolder TotalItemsInView="2">
            <t:Items>
              <t:CalendarItem>
                <t:ItemId Id="AAMkAAA1" ChangeKey="DwAA" />
                <t:Subject>Contoso devs team meeting</t:Subject>
                <t:Start>2013-08-21T19:30:00Z</t:Start>
                <t:End>2013-08-21T20:00:00Z</t:End>
              </t:CalendarItem>
              <t:CalendarItem>
                <t:ItemId Id="AAMkAAA2" ChangeKey="DwAA" />
                <t:Subject>Lunch with sales team</t:Subject>
                <t:Start>2013-08-21T21:30:00Z</t:Start>
                <t:End>2013-08-21T22:30:00Z</t:End>
              </t:CalendarItem>
            </t:Items>
          </m:RootFolder>
        </m:FindItemResponseMessage>
      </m:ResponseMessages>
    </m:FindItemResponse>
  </s:Body>
</s:Envelope>`

const ERROR_XML = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="https://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:FindItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
      <m:ResponseMessages>
        <m:FindItemResponseMessage ResponseClass="Error">
          <m:MessageText>Access is denied. Check credentials and try again.</m:MessageText>
          <m:ResponseCode>ErrorAccessDenied</m:ResponseCode>
        </m:FindItemResponseMessage>
      </m:ResponseMessages>
    </m:FindItemResponse>
  </s:Body>
</s:Envelope>`

describe('normalizeServerUrl', () => {
  it('appends the EWS path to a bare host', () => {
    expect(normalizeServerUrl('mail.corp.com')).toBe('https://mail.corp.com/EWS/Exchange.asmx')
  })

  it('keeps an explicit https scheme', () => {
    expect(normalizeServerUrl('https://mail.corp.com')).toBe('https://mail.corp.com/EWS/Exchange.asmx')
  })

  it('keeps a full EWS url unchanged', () => {
    expect(normalizeServerUrl('https://mail.corp.com/EWS/Exchange.asmx')).toBe(
      'https://mail.corp.com/EWS/Exchange.asmx'
    )
  })

  it('does not duplicate the EWS path when case differs', () => {
    expect(normalizeServerUrl('https://mail.corp.com/ews/exchange.asmx')).toBe(
      'https://mail.corp.com/ews/exchange.asmx'
    )
  })

  it('rejects plain http', () => {
    expect(() => normalizeServerUrl('http://mail.corp.com')).toThrow(/https/i)
  })

  it('rejects an empty address', () => {
    expect(() => normalizeServerUrl('   ')).toThrow()
  })
})

describe('pickAuthScheme', () => {
  it('prefers basic when the server offers it', () => {
    expect(pickAuthScheme('Basic realm="Exchange"')).toBe('basic')
  })

  it('detects ntlm', () => {
    expect(pickAuthScheme('NTLM')).toBe('ntlm')
    expect(pickAuthScheme('Negotiate')).toBe('ntlm')
  })

  it('prefers basic over ntlm when both are offered', () => {
    expect(pickAuthScheme('Basic, NTLM')).toBe('basic')
    expect(pickAuthScheme('Negotiate, NTLM, Basic')).toBe('basic')
  })

  it('returns none when nothing usable is offered', () => {
    expect(pickAuthScheme(null)).toBe('none')
    expect(pickAuthScheme('Bearer')).toBe('none')
  })
})

describe('splitUsername', () => {
  it('splits DOMAIN\\user', () => {
    expect(splitUsername('CORP\\jane')).toEqual({ username: 'jane', domain: 'CORP' })
  })

  it('keeps a UPN intact', () => {
    expect(splitUsername('jane@corp.com')).toEqual({ username: 'jane@corp.com', domain: '' })
  })

  it('keeps a plain name intact', () => {
    expect(splitUsername('jane')).toEqual({ username: 'jane', domain: '' })
  })
})

describe('findItemXml', () => {
  it('builds a CalendarView request over the default calendar folder', () => {
    const xml = findItemXml('2026-09-24T10:00:00.000Z', '2026-09-24T11:00:00.000Z')
    expect(xml).toContain('FindItem')
    expect(xml).toContain('MaxEntriesReturned="50"')
    expect(xml).toContain('StartDate="2026-09-24T10:00:00.000Z"')
    expect(xml).toContain('EndDate="2026-09-24T11:00:00.000Z"')
    expect(xml).toContain('DistinguishedFolderId Id="calendar"')
    expect(xml).toContain('item:Subject')
    expect(xml).toContain('calendar:Start')
  })
})

describe('parseFindItemResponse', () => {
  it('extracts calendar items with exchange: ids', () => {
    const events = parseFindItemResponse(SUCCESS_XML)
    expect(events).toEqual([
      {
        id: 'exchange:AAMkAAA1',
        title: 'Contoso devs team meeting',
        start: Date.parse('2013-08-21T19:30:00Z')
      },
      {
        id: 'exchange:AAMkAAA2',
        title: 'Lunch with sales team',
        start: Date.parse('2013-08-21T21:30:00Z')
      }
    ])
  })

  it('decodes xml entities in subjects', () => {
    const xml = `<?xml version="1.0"?><m:FindItemResponse
      xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"
      xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
      <m:ResponseMessages><m:FindItemResponseMessage ResponseClass="Success"><m:RootFolder><t:Items>
        <t:CalendarItem><t:ItemId Id="X1"/><t:Subject>R&amp;D &lt;planning&gt;</t:Subject><t:Start>2026-09-24T10:00:00Z</t:Start></t:CalendarItem>
      </t:Items></m:RootFolder></m:FindItemResponseMessage></m:ResponseMessages>
    </m:FindItemResponse>`
    expect(parseFindItemResponse(xml)).toEqual([
      { id: 'exchange:X1', title: 'R&D <planning>', start: Date.parse('2026-09-24T10:00:00Z') }
    ])
  })

  it('returns nothing for an empty calendar', () => {
    const xml = SUCCESS_XML.replace(/<t:CalendarItem>[\s\S]*?<\/t:CalendarItem>/g, '')
    expect(parseFindItemResponse(xml)).toEqual([])
  })

  it('returns nothing for non-xml junk', () => {
    expect(parseFindItemResponse('<html><body>Moved</body></html>')).toEqual([])
  })
})

describe('findItemError', () => {
  it('surfaces the server error message', () => {
    expect(findItemError(ERROR_XML)).toBe('Access is denied. Check credentials and try again.')
  })

  it('returns null for a success response', () => {
    expect(findItemError(SUCCESS_XML)).toBeNull()
  })
})
