import { describe, expect, it } from 'vitest'
import {
  createLmHashedPassword,
  createNtHashedPassword,
  createType1Message,
  createType3Message,
  ntowfV2,
  ntlm2srResponses,
  parseType2Message,
  type Type2Message
} from './ntlm'

// --- Test vectors from [MS-NLMP] v37.0 §4.2 (March 2026) ---------------------
// https://winprotocoldocs-bhdugrdyduf5h2e4.b02.azurefd.net/MS-NLMP/[MS-NLMP].pdf
// User="User", Domain="Domain", Password="Password", ServerChallenge=0123456789abcdef,
// ClientChallenge=aa*8.
const NT_HASH = 'a4f49c406510bdcab6824ee7c30fd852' // §4.2.2.1.2 = MD4(UTF-16LE("Password"))
const LM_HASH = 'e52cac67419a9a224a3b108f3fa6cb6d' // §4.2.2.1.1 LMOWFv1
const NTOWF_V2 = '0c868a403bfd7a93a3001ef22ef02e3f' // §4.2.4.1.1 (identity "USER" + "Domain")
const CHALLENGE = Buffer.from('0123456789abcdef', 'hex')
const CLIENT_CHALLENGE = Buffer.alloc(8, 0xaa)

// §4.2.3.2 (NTLMv1 with client challenge / extended session security, no target info)
const NTLM_V1_SESSION_SECURITY = '7537f803ae367128ca458204bde7caf81e97ed2683267232'
const LM_V1_SESSION_SECURITY = 'aa'.repeat(8) + '00'.repeat(16)

// --- Golden wire messages, recorded byte-for-byte from httpntlm@1.8.13 (MIT,
// the implementation this file ports) with neutralized randomness:
// Math.random=()=>0.25 (clientChallenge bytes = 0x41), Date.now=1700000000000.
// These lock the port to the handshake behaviour that works against real
// Exchange servers today.
const GOLDEN_TYPE1 =
  'NTLM TlRMTVNTUAABAAAAB7IIogYABgAzAAAACwALACgAAAAFASgKAAAAD1dPUktTVEFUSU9ORE9NQUlO'
const GOLDEN_TYPE3 =
  'NTLM TlRMTVNTUAADAAAAGAAYAHIAAABUAFQAigAAAAwADABIAAAACAAIAFQAAAAWABYAXAAAAAAAAADeAAAABYKIogUBKAoAAAAPRABPAE0AQQBJAE4AVQBzAGUAcgBXAE8AUgBLAFMAVABBAFQASQBPAE4A1aYFVH4JDBcbQ58aj5aTqEBAQEBAQEBArzSHD/kIbJJfRAhgMPYZbAEBAAAAAAAAAABtxkcX2gFAQEBAQEBAQAAAAAACAAwARABvAG0AYQBpAG4AAQAMAFMAZQByAHYAZQByAAAAAAAAAAAA'

// Deterministic challenge context shared by the golden messages above:
// targetInfo = MsvAvNbDomainName"Domain" + MsvAvNbComputerName"Server" + AvEOL,
// flags = UNICODE | ALWAYS_SIGN | EXTENDED_SESSIONSECURITY | TARGET_INFO | VERSION | 128 | 56,
// fixed timestamp for Date.now()=1700000000000 and clientChallenge 'AAAAAAAA'.
const TARGET_INFO = Buffer.concat([
  Buffer.from([0x02, 0x00, 0x0c, 0x00]),
  Buffer.from('Domain', 'utf16le'),
  Buffer.from([0x01, 0x00, 0x0c, 0x00]),
  Buffer.from('Server', 'utf16le'),
  Buffer.from([0x00, 0x00, 0x00, 0x00])
])
const CREDENTIALS = { username: 'User', password: 'Password', domain: 'Domain', workstation: 'WORKSTATION' }
const INJECT = { clientChallenge: Buffer.from('@@@@@@@@', 'ascii'), timestamp: 1700000000000 }

function type2Message(negotiateFlags: number, targetInfo: Buffer | null): Type2Message {
  return { negotiateFlags, serverChallenge: CHALLENGE, targetInfo }
}

describe('password hashes ([MS-NLMP] §4.2)', () => {
  it('computes the NT hash as MD4 of UTF-16LE password', () => {
    expect(createNtHashedPassword('Password').toString('hex')).toBe(NT_HASH)
  })

  it('computes the LM hash per LMOWFv1', () => {
    expect(createLmHashedPassword('Password').toString('hex')).toBe(LM_HASH)
  })

  it('computes NTOWFv2 per the §4.2.4.1.1 example', () => {
    expect(ntowfV2(createNtHashedPassword('Password'), 'USER', 'Domain').toString('hex')).toBe(NTOWF_V2)
  })
})

describe('ntlm2sr (NTLMv1 with session security, [MS-NLMP] §4.2.3)', () => {
  it('matches the documented LM and NT challenge responses', () => {
    const { lm, nt } = ntlm2srResponses(Buffer.from(NT_HASH, 'hex'), CHALLENGE, Buffer.alloc(8, 0xaa))
    expect(lm.toString('hex')).toBe(LM_V1_SESSION_SECURITY)
    expect(nt.toString('hex')).toBe(NTLM_V1_SESSION_SECURITY)
  })
})

describe('type 1 message', () => {
  it('is byte-identical to the recorded httpntlm message', () => {
    expect(createType1Message(CREDENTIALS)).toBe(GOLDEN_TYPE1)
  })

  it('decodes as an NTLMSSP negotiate message with the expected flags', () => {
    const buf = Buffer.from(GOLDEN_TYPE1.slice('NTLM '.length), 'base64')
    expect(buf.subarray(0, 8).toString('latin1')).toBe('NTLMSSP\0')
    expect(buf.readUInt32LE(8)).toBe(1) // type 1
    expect(buf.readUInt32LE(12)).toBe(0xa208b207) // negotiate flags we request
  })
})

describe('type 2 parsing', () => {
  it('extracts challenge, flags and target info', () => {
    const targetName = Buffer.from('Server', 'utf16le')
    const ti = Buffer.from('01020c00', 'hex')
    const buf = Buffer.concat([
      Buffer.from('NTLMSSP\0', 'ascii'),
      (() => {
        const b = Buffer.alloc(4)
        b.writeUInt32LE(2)
        return b
      })(),
      (() => {
        const b = Buffer.alloc(8)
        b.writeUInt16LE(12, 0)
        b.writeUInt16LE(12, 2)
        b.writeUInt32LE(48, 4)
        return b
      })(),
      (() => {
        const b = Buffer.alloc(4)
        b.writeUInt32LE(0xa2888001)
        return b
      })(),
      CHALLENGE,
      Buffer.alloc(8),
      (() => {
        const b = Buffer.alloc(8)
        b.writeUInt16LE(ti.length, 0)
        b.writeUInt16LE(ti.length, 2)
        b.writeUInt32LE(60, 4)
        return b
      })(),
      targetName,
      ti
    ])
    const parsed = parseType2Message('NTLM ' + buf.toString('base64'))
    expect(parsed.serverChallenge.toString('hex')).toBe('0123456789abcdef')
    expect(parsed.negotiateFlags).toBe(0xa2888001)
    expect(parsed.targetInfo?.toString('hex')).toBe('01020c00')
  })

  it('throws on a non-NTLM challenge header', () => {
    expect(() => parseType2Message('Basic realm="exchange"')).toThrow()
  })
})

describe('type 3 message (NTLMv2)', () => {
  const flags = 0xa2888001

  it('is byte-identical to the httpntlm output it replaces', () => {
    const message = createType3Message(type2Message(flags, TARGET_INFO), CREDENTIALS, INJECT)
    expect(message).toBe(GOLDEN_TYPE3)
  })

  it('hashes the domain uppercased, whatever case the user typed', () => {
    const lower = createType3Message(type2Message(flags, TARGET_INFO), { ...CREDENTIALS, domain: 'domain' }, INJECT)
    expect(lower).toBe(GOLDEN_TYPE3)
  })

  it('falls back to NTLMv1+session security when the challenge carries no target info', () => {
    const message = createType3Message(type2Message(flags & ~0x00800000, null), CREDENTIALS, INJECT)
    const buf = Buffer.from(message.slice('NTLM '.length), 'base64')
    // NT challenge response = proof(16) + temp; with NTLMv1 session security the
    // NT response is calc_resp(hash, md5(challenge||client)[0..8]) — just check
    // it parses as a well-formed AUTHENTICATE message of the right type.
    expect(buf.readUInt32LE(8)).toBe(3)
    expect(buf.subarray(0, 8).toString('latin1')).toBe('NTLMSSP\0')
  })

  it('randomizes the client challenge by default', () => {
    const a = createType3Message(type2Message(flags, TARGET_INFO), CREDENTIALS)
    const b = createType3Message(type2Message(flags, TARGET_INFO), CREDENTIALS)
    expect(a).not.toBe(b)
  })
})
