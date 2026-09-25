import { describe, expect, it } from 'vitest'
import { attachDetails, DETAILS_MARKER, splitErrorDetails, stripIpcPrefix } from './error-details'

describe('attachDetails / splitErrorDetails', () => {
  it('appends details after the marker and round-trips through split', () => {
    const msg = attachDetails('Сервер отклонил вход.', ['endpoint: https://x/EWS', 'type3 → HTTP 401'])
    expect(msg.startsWith('Сервер отклонил вход.')).toBe(true)
    expect(msg).toContain(DETAILS_MARKER)
    const { main, details } = splitErrorDetails(msg)
    expect(main).toBe('Сервер отклонил вход.')
    expect(details).toBe('endpoint: https://x/EWS\ntype3 → HTTP 401')
  })

  it('keeps a message without details intact', () => {
    expect(attachDetails('plain', [])).toBe('plain')
    const { main, details } = splitErrorDetails('just a message')
    expect(main).toBe('just a message')
    expect(details).toBeNull()
  })

  it('splits only at the first marker', () => {
    const msg = attachDetails('main text', ['a', 'b', DETAILS_MARKER])
    const { main, details } = splitErrorDetails(msg)
    expect(main).toBe('main text')
    expect(details).toContain('a\nb')
  })
})

describe('stripIpcPrefix', () => {
  it('removes the Electron invoke wrapper', () => {
    const raw = "Error invoking remote method 'cal:connect': Error: Сервер отклонил вход."
    expect(stripIpcPrefix(raw)).toBe('Сервер отклонил вход.')
  })
  it('leaves plain messages untouched', () => {
    expect(stripIpcPrefix('network down')).toBe('network down')
  })
})
