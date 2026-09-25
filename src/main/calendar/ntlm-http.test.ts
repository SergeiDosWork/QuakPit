import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ntlmPost } from './ntlm-http'

// A fake EWS endpoint that speaks just enough NTLM to drive the handshake:
// 401 + a challenge on the first POST, 200 on the second. Modes override the
// response so each test can provoke a failure without extra listeners.
const TYPE2 = (() => {
  const buf = Buffer.alloc(40)
  buf.write('NTLMSSP\0', 0, 8, 'ascii')
  buf.writeUInt32LE(2, 8)
  buf.writeUInt16LE(0, 12) // target name: none
  buf.writeUInt16LE(0, 14)
  buf.writeUInt32LE(32, 16)
  buf.writeUInt32LE(0x00080001, 20) // UNICODE | EXTENDED_SESSIONSECURITY
  Buffer.from('0123456789abcdef', 'hex').copy(buf, 24)
  return 'NTLM ' + buf.toString('base64')
})()

type Mode = 'normal' | 'redirect' | 'status503'

let server: Server
let origin = ''
let mode: Mode
let socketCount = 0
let authHeaders: string[] = []
let bodies: string[] = []

beforeEach(async () => {
  mode = 'normal'
  socketCount = 0
  authHeaders = []
  bodies = []
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const auth = req.headers.authorization ?? ''
    let body = ''
    req.on('data', (c) => {
      body += c
    })
    req.on('end', () => {
      authHeaders.push(String(auth))
      bodies.push(body)
      if (mode === 'redirect') {
        res.writeHead(302, { Location: 'http://127.0.0.1:1/steal' })
        res.end()
      } else if (mode === 'status503') {
        res.writeHead(503)
        res.end()
      } else if (authHeaders.length === 1) {
        res.writeHead(401, { 'WWW-Authenticate': TYPE2 })
        res.end()
      } else {
        res.writeHead(200, { 'Content-Type': 'text/xml' })
        res.end('<Response>ok</Response>')
      }
    })
  })
  server.on('connection', () => {
    socketCount++
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/EWS/Exchange.asmx`
})

afterAll(() => {
  server.closeAllConnections?.()
  server.close()
})

const CREDENTIALS = { username: 'User', password: 'Password', domain: 'DOMAIN', workstation: '' }

describe('ntlmPost', () => {
  it('completes the handshake on one connection and returns the body', async () => {
    const res = await ntlmPost({ url: origin, ...CREDENTIALS, body: '<FindItem/>', timeoutMs: 5000 })
    expect(res.status).toBe(200)
    expect(res.body).toBe('<Response>ok</Response>')
    expect(authHeaders.length).toBe(2)
    expect(Buffer.from(authHeaders[0].slice(5), 'base64').readUInt32LE(8)).toBe(1)
    expect(Buffer.from(authHeaders[1].slice('NTLM '.length), 'base64').readUInt32LE(8)).toBe(3)
    expect(bodies[1]).toBe('<FindItem/>')
    expect(socketCount).toBe(1) // type 3 rode the same socket as type 1
  })

  it('refuses to follow a redirect instead of re-handshaking elsewhere', async () => {
    mode = 'redirect'
    await expect(ntlmPost({ url: origin, ...CREDENTIALS, body: '<FindItem/>', timeoutMs: 5000 })).rejects.toThrow(
      /redirect/i
    )
    expect(authHeaders.length).toBe(1) // only the first probe was sent
  })

  it('surfaces non-401 challenge responses instead of parsing them', async () => {
    mode = 'status503'
    await expect(ntlmPost({ url: origin, ...CREDENTIALS, body: '<FindItem/>', timeoutMs: 5000 })).rejects.toThrow(
      /status 503/
    )
  })

  it('drives https targets with a TLS-capable agent (regression: http.Agent → "Protocol not supported")', async () => {
    // The local server is plaintext http, but the URL says https: — the request
    // must get past ClientRequest construction (old bug: an http.Agent handed
    // to https.request threw "Protocol \"https:\" not supported") and fail at
    // the TLS layer instead.
    const httpsUrl = origin.replace('http://', 'https://')
    let error: Error | null = null
    try {
      await ntlmPost({ url: httpsUrl, ...CREDENTIALS, body: '<FindItem/>', timeoutMs: 5000 })
    } catch (e) {
      error = e as Error
    }
    expect(error).not.toBeNull() // TLS against a plaintext server must still fail
    expect(String(error?.message)).not.toMatch(/Protocol .+ not supported/)
  })
})
