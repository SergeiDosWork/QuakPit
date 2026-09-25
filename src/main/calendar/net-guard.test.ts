import { describe, expect, it } from 'vitest'
import { isTrustedIcloudUrl, normalizeFeedUrl, readBodyWithLimit } from './net-guard'

describe('normalizeFeedUrl (iCal policy: https only)', () => {
  it('accepts https feeds as-is', () => {
    expect(normalizeFeedUrl('https://example.com/cal.ics')).toBe('https://example.com/cal.ics')
  })

  it('rewrites webcal:// to https://', () => {
    expect(normalizeFeedUrl('webcal://example.com/cal.ics')).toBe('https://example.com/cal.ics')
    expect(normalizeFeedUrl('WEBCAL://example.com/cal.ics')).toBe('https://example.com/cal.ics')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeFeedUrl('  https://example.com/cal.ics  ')).toBe('https://example.com/cal.ics')
  })

  it('rejects plain http:// (MITM could forge meeting reminders)', () => {
    expect(() => normalizeFeedUrl('http://example.com/cal.ics')).toThrow(/https/)
  })

  it('rejects non-web schemes like file://', () => {
    expect(() => normalizeFeedUrl('file:///etc/passwd')).toThrow(/https/)
    expect(() => normalizeFeedUrl('javascript:alert(1)')).toThrow(/https/)
  })
})

describe('isTrustedIcloudUrl (CalDAV policy)', () => {
  it('trusts https endpoints on icloud.com and its subdomains', () => {
    expect(isTrustedIcloudUrl('https://caldav.icloud.com/')).toBe(true)
    expect(isTrustedIcloudUrl('https://p123-caldav.icloud.com/principal/user/')).toBe(true)
  })

  it('rejects plain http and foreign hosts', () => {
    expect(isTrustedIcloudUrl('http://caldav.icloud.com/')).toBe(false)
    expect(isTrustedIcloudUrl('https://evil.example/')).toBe(false)
  })

  it('rejects look-alike hosts that merely contain icloud.com', () => {
    expect(isTrustedIcloudUrl('https://icloud.com.evil.example/')).toBe(false)
    expect(isTrustedIcloudUrl('https://caldav.icloud.com.evil.example/')).toBe(false)
  })
})

describe('readBodyWithLimit', () => {
  it('returns the body when it fits the cap', async () => {
    const res = new Response('BEGIN:VCALENDAR')
    await expect(readBodyWithLimit(res, 1024)).resolves.toBe('BEGIN:VCALENDAR')
  })

  it('refuses up-front when content-length already exceeds the cap', async () => {
    const res = new Response('x', { headers: { 'content-length': String(10 * 1024 * 1024 + 1) } })
    await expect(readBodyWithLimit(res, 10 * 1024 * 1024)).rejects.toThrow(/large/)
  })

  it('aborts mid-stream when the chunked body exceeds the cap', async () => {
    const chunk = 'x'.repeat(1024)
    const stream = new ReadableStream({
      start(controller) {
        // keep pushing forever; the reader must bail out at the cap
        controller.enqueue(new TextEncoder().encode(chunk.repeat(4)))
        controller.close()
      }
    })
    const res = new Response(stream)
    await expect(readBodyWithLimit(res, 2048)).rejects.toThrow(/large/)
  })
})
