// NTLMv2 message construction, ported 1:1 from httpntlm@1.8.13's ntlm.js
// (MIT, © 2013 Sam Decrock, https://github.com/SamDecrock/node-httpntlm).
//
// Why a port instead of the dependency: the httpntlm HTTP wrapper follows
// Location redirects by restarting the whole handshake on the redirect target,
// including http:// downgrades and cross-host hops, which sends the NTLM proof
// (offline-crackable) to whoever the server points at. This module keeps the
// crypto core byte-compatible — verified against the [MS-NLMP] §4.2 test
// vectors and recorded httpntlm output in ntlm.test.ts — while the HTTP driver
// (ntlm-http.ts) never follows redirects.
//
// Domain/workstation are uppercased for both the message fields and the key
// derivation, exactly as httpntlm did (recorded golden proves lowercase input
// produces identical output).

import { createHash, createHmac, randomBytes } from 'node:crypto'
import * as desjs from 'des.js'
import * as jsmd4 from 'js-md4'

export type NtlmCredentials = {
  username: string
  password: string
  domain?: string
  workstation?: string
}

export type Type2Message = {
  negotiateFlags: number
  serverChallenge: Buffer
  targetInfo: Buffer | null
}

/** Determinism hooks for tests: inject the client challenge and timestamp. */
export type NtlmInject = { clientChallenge?: Buffer; timestamp?: number }

const flags = {
  NegotiateUnicode: 0x00000001,
  NegotiateOEM: 0x00000002,
  RequestTarget: 0x00000004,
  NegotiateNTLM: 0x00000200,
  NegotiateOemDomainSupplied: 0x00001000,
  NegotiateOemWorkstationSupplied: 0x00002000,
  NegotiateAlwaysSign: 0x00008000,
  NegotiateExtendedSecurity: 0x00080000,
  NegotiateTargetInfo: 0x00800000,
  NegotiateVersion: 0x02000000,
  Negotiate128: 0x20000000,
  Negotiate56: 0x80000000
}

const TYPE1_FLAGS =
  flags.NegotiateUnicode +
  flags.NegotiateOEM +
  flags.RequestTarget +
  flags.NegotiateNTLM +
  flags.NegotiateOemDomainSupplied +
  flags.NegotiateOemWorkstationSupplied +
  flags.NegotiateAlwaysSign +
  flags.NegotiateExtendedSecurity +
  flags.NegotiateVersion +
  flags.Negotiate128 +
  flags.Negotiate56

// The AUTHENTICATE (type 3) message echoes this flag set (Fix #98 in httpntlm).
const TYPE2_FLAGS =
  flags.NegotiateUnicode +
  flags.RequestTarget +
  flags.NegotiateNTLM +
  flags.NegotiateAlwaysSign +
  flags.NegotiateExtendedSecurity +
  flags.NegotiateTargetInfo +
  flags.NegotiateVersion +
  flags.Negotiate128 +
  flags.Negotiate56

// Same semantics as the legacy global escape(): bytes outside the safe ASCII
// set become %XX (and %uXXXX above U+00FF) so the result stays ASCII-safe.
function escape(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (/[A-Za-z0-9@*_+\-./]/.test(ch)) out += ch
    else if (code < 256) out += '%' + code.toString(16).toUpperCase().padStart(2, '0')
    else out += '%u' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

function hmacMd5(key: Buffer, data: Buffer): Buffer {
  return createHmac('md5', key).update(data).digest()
}

function md4(data: Buffer): Buffer {
  const hash = jsmd4.create()
  hash.update(data)
  return Buffer.from(hash.digest())
}

function insertZerosEvery7Bits(buf: Buffer): Buffer {
  const bits: number[] = []
  for (const byte of buf) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1)
  }
  const withZeros: number[] = []
  bits.forEach((bit, i) => {
    withZeros.push(bit)
    if ((i + 1) % 7 === 0) withZeros.push(0)
  })
  const out = Buffer.alloc(Math.floor(withZeros.length / 8))
  for (let i = 0; i + 8 <= withZeros.length; i += 8) {
    let value = 0
    for (let j = 0; j < 8; j++) value = (value << 1) | withZeros[i + j]
    out[i / 8] = value
  }
  return out
}

function desEncrypt(key: Buffer, data: Buffer): Buffer {
  const des = desjs.DES.create({ type: 'encrypt', key })
  return Buffer.from(des.update(data))
}

// --- password hashes ----------------------------------------------------------

/** NT hash: MD4 over the UTF-16LE password. */
export function createNtHashedPassword(password: string): Buffer {
  return md4(Buffer.from(password, 'utf16le'))
}

/** LM hash (LMOWFv1): DES of the upper-cased password halves. */
export function createLmHashedPassword(password: string): Buffer {
  const bytes = Buffer.from(password.toUpperCase(), 'ascii')
  const padded = Buffer.alloc(14)
  bytes.copy(padded, 0, 0, Math.min(bytes.length, 14))

  const encrypt = (chunk: Buffer): Buffer => {
    const key = insertZerosEvery7Bits(chunk)
    const magic = Buffer.from('KGS!@#$%', 'ascii')
    return desEncrypt(key, magic)
  }

  return Buffer.concat([encrypt(padded.subarray(0, 7)), encrypt(padded.subarray(7))])
}

/** NTOWFv2: HMAC-MD5 of the NT hash keyed with the identity. Per [MS-NLMP]
 * 3.3.2 the username part is upper-cased, the domain is taken as given. */
export function ntowfV2(ntHash: Buffer, usernameUpper: string, domain: string): Buffer {
  return hmacMd5(ntHash, Buffer.from(usernameUpper + domain, 'utf16le'))
}

// --- challenge responses ------------------------------------------------------

/** LM/NT challenge response blocks (NTLMv1 core), [MS-NLMP] 3.3.1. */
function calcResp(passwordHash: Buffer, serverChallenge: Buffer): Buffer {
  const padded = Buffer.alloc(21)
  passwordHash.copy(padded, 0, 0, passwordHash.length)
  const parts: Buffer[] = []
  for (const offset of [0, 7, 14]) {
    const key = insertZerosEvery7Bits(padded.subarray(offset, offset + 7))
    parts.push(desEncrypt(key, serverChallenge.subarray(0, 8)))
  }
  return Buffer.concat(parts)
}

/** NTLMv1 with session security (NTLMSSP_NEGOTIATE_EXTENDED_SESSIONSECURITY
 * without target info), [MS-NLMP] 3.3.1 / §4.2.3. */
export function ntlm2srResponses(
  passwordHash: Buffer,
  serverChallenge: Buffer,
  clientChallenge: Buffer
): { lm: Buffer; nt: Buffer } {
  const lm = Buffer.alloc(clientChallenge.length + 16)
  clientChallenge.copy(lm, 0, 0, clientChallenge.length)
  const session = createHash('md5').update(Buffer.concat([serverChallenge, clientChallenge])).digest()
  return { lm, nt: calcResp(passwordHash, session.subarray(0, 8)) }
}

/** Full NTLMv2 responses, [MS-NLMP] 3.3.2. */
function calcNtlmV2Responses(
  passwordHash: Buffer,
  username: string,
  domain: string,
  targetInfo: Buffer,
  serverChallenge: Buffer,
  clientChallenge: Buffer,
  timestampMs: number
): { lm: Buffer; nt: Buffer } {
  const responseKey = ntowfV2(passwordHash, username.toUpperCase(), domain)

  const lm = Buffer.concat([hmacMd5(responseKey, Buffer.concat([serverChallenge, clientChallenge])), clientChallenge])

  // 11644473600000 = seconds between 1601 (NT epoch) and 1970, in ms.
  const timestamp = (BigInt(timestampMs) + 11644473600000n) * 10000n
  const timestampBuffer = Buffer.alloc(8)
  timestampBuffer.writeBigUInt64LE(timestamp)

  const zero32 = Buffer.alloc(4)
  const temp = Buffer.concat([
    Buffer.from([0x01, 0x01, 0x00, 0x00]), // version
    zero32,
    timestampBuffer,
    clientChallenge,
    zero32,
    targetInfo,
    zero32
  ])
  const proof = hmacMd5(responseKey, Buffer.concat([serverChallenge, temp]))
  return { lm, nt: Buffer.concat([proof, temp]) }
}

// --- messages -----------------------------------------------------------------

/** Builds the NTLMSSP NEGOTIATE (type 1) message. */
export function createType1Message(creds: NtlmCredentials): string {
  const domain = escape((creds.domain ?? '').toUpperCase())
  const workstation = escape((creds.workstation ?? '').toUpperCase())
  const protocol = 'NTLMSSP\0'

  const bodyLength = 40
  let type1flags = TYPE1_FLAGS
  if (domain === '') type1flags -= flags.NegotiateOemDomainSupplied

  let pos = 0
  const buf = Buffer.alloc(bodyLength + domain.length + workstation.length)

  buf.write(protocol, pos, protocol.length)
  pos += protocol.length
  buf.writeUInt32LE(1, pos)
  pos += 4
  buf.writeUInt32LE(type1flags, pos)
  pos += 4

  buf.writeUInt16LE(domain.length, pos)
  pos += 2
  buf.writeUInt16LE(domain.length, pos)
  pos += 2
  buf.writeUInt32LE(bodyLength + workstation.length, pos)
  pos += 4

  buf.writeUInt16LE(workstation.length, pos)
  pos += 2
  buf.writeUInt16LE(workstation.length, pos)
  pos += 2
  buf.writeUInt32LE(bodyLength, pos)
  pos += 4

  buf.writeUInt8(5, pos)
  pos += 1
  buf.writeUInt8(1, pos)
  pos += 1
  buf.writeUInt16LE(2600, pos)
  pos += 2
  buf.writeUInt8(0, pos)
  pos += 1
  buf.writeUInt8(0, pos)
  pos += 1
  buf.writeUInt8(0, pos)
  pos += 1
  buf.writeUInt8(15, pos)
  pos += 1

  if (workstation.length !== 0) buf.write(workstation, pos, workstation.length, 'ascii')
  pos += workstation.length
  if (domain.length !== 0) buf.write(domain, pos, domain.length, 'ascii')
  pos += domain.length

  return 'NTLM ' + buf.toString('base64')
}

/** Parses the WWW-Authenticate challenge into the CHALLENGE (type 2) message.
 * Throws when the header is not an NTLM challenge. */
export function parseType2Message(rawHeader: string): Type2Message {
  const match = /NTLM (.+)?/.exec(rawHeader)
  if (!match?.[1]) throw new Error('no NTLM token in the challenge header')
  const buf = Buffer.from(match[1], 'base64')

  if (buf.readInt16LE(8) !== 2) throw new Error('challenge message is not type 2')

  // Flags are read unsigned: every consumer checks them with bitwise ANDs,
  // which is identical for the two representations, but unsigned keeps the
  // value comparable with the message constants.
  const negotiateFlags = buf.readUInt32LE(20)
  const serverChallenge = buf.subarray(24, 32)

  let targetInfo: Buffer | null = null
  if (negotiateFlags & flags.NegotiateTargetInfo) {
    const len = buf.readInt16LE(40)
    const offset = buf.readInt32LE(44)
    targetInfo = buf.subarray(offset, offset + len)
  }
  return { negotiateFlags, serverChallenge, targetInfo }
}

/** Builds the AUTHENTICATE (type 3) message: NTLMv2 when the server offered
 * target info, NTLMv1 with session security otherwise — mirroring httpntlm. */
export function createType3Message(msg2: Type2Message, creds: NtlmCredentials, inject?: NtlmInject): string {
  const domain = escape((creds.domain ?? '').toUpperCase())
  const workstation = escape((creds.workstation ?? '').toUpperCase())
  const username = creds.username ?? ''
  const password = creds.password ?? ''
  const negotiateFlags = msg2.negotiateFlags

  const isUnicode = negotiateFlags & flags.NegotiateUnicode
  const extendedSecurity = negotiateFlags & flags.NegotiateExtendedSecurity

  const bodyLength = 72

  const domainNameBytes = Buffer.from(domain, isUnicode ? 'utf16le' : 'ascii')
  const workstationBytes = Buffer.from(workstation, isUnicode ? 'utf16le' : 'ascii')
  const usernameBytes = Buffer.from(username, isUnicode ? 'utf16le' : 'ascii')
  const encryptedSessionKeyBytes = Buffer.alloc(0)

  const nonce = msg2.serverChallenge
  let lmChallengeResponse = calcResp(createLmHashedPassword(password), nonce)
  let ntChallengeResponse = calcResp(createNtHashedPassword(password), nonce)

  if (extendedSecurity) {
    const passwordHash = createNtHashedPassword(password)
    const clientChallenge = inject?.clientChallenge ?? randomBytes(8)
    const responses = msg2.targetInfo
      ? calcNtlmV2Responses(
          passwordHash,
          username,
          domain,
          msg2.targetInfo,
          nonce,
          clientChallenge,
          inject?.timestamp ?? Date.now()
        )
      : ntlm2srResponses(passwordHash, nonce, clientChallenge)
    lmChallengeResponse = responses.lm
    ntChallengeResponse = responses.nt
  }

  const signature = 'NTLMSSP\0'
  let pos = 0
  const buf = Buffer.alloc(
    bodyLength +
      domainNameBytes.length +
      usernameBytes.length +
      workstationBytes.length +
      lmChallengeResponse.length +
      ntChallengeResponse.length +
      encryptedSessionKeyBytes.length
  )

  buf.write(signature, pos, signature.length)
  pos += signature.length
  buf.writeUInt32LE(3, pos)
  pos += 4

  buf.writeUInt16LE(lmChallengeResponse.length, pos)
  pos += 2
  buf.writeUInt16LE(lmChallengeResponse.length, pos)
  pos += 2
  buf.writeUInt32LE(bodyLength + domainNameBytes.length + usernameBytes.length + workstationBytes.length, pos)
  pos += 4

  buf.writeUInt16LE(ntChallengeResponse.length, pos)
  pos += 2
  buf.writeUInt16LE(ntChallengeResponse.length, pos)
  pos += 2
  buf.writeUInt32LE(bodyLength + domainNameBytes.length + usernameBytes.length + workstationBytes.length + lmChallengeResponse.length, pos)
  pos += 4

  buf.writeUInt16LE(domainNameBytes.length, pos)
  pos += 2
  buf.writeUInt16LE(domainNameBytes.length, pos)
  pos += 2
  buf.writeUInt32LE(bodyLength, pos)
  pos += 4

  buf.writeUInt16LE(usernameBytes.length, pos)
  pos += 2
  buf.writeUInt16LE(usernameBytes.length, pos)
  pos += 2
  buf.writeUInt32LE(bodyLength + domainNameBytes.length, pos)
  pos += 4

  buf.writeUInt16LE(workstationBytes.length, pos)
  pos += 2
  buf.writeUInt16LE(workstationBytes.length, pos)
  pos += 2
  buf.writeUInt32LE(bodyLength + domainNameBytes.length + usernameBytes.length, pos)
  pos += 4

  buf.writeUInt16LE(encryptedSessionKeyBytes.length, pos)
  pos += 2
  buf.writeUInt16LE(encryptedSessionKeyBytes.length, pos)
  pos += 2
  buf.writeUInt32LE(
    bodyLength +
      domainNameBytes.length +
      usernameBytes.length +
      workstationBytes.length +
      lmChallengeResponse.length +
      ntChallengeResponse.length,
    pos
  )
  pos += 4

  const flagsToWrite = isUnicode ? TYPE2_FLAGS : TYPE2_FLAGS - flags.NegotiateUnicode
  buf.writeUInt32LE(flagsToWrite, pos)
  pos += 4

  buf.writeUInt8(5, pos)
  pos += 1
  buf.writeUInt8(1, pos)
  pos += 1
  buf.writeUInt16LE(2600, pos)
  pos += 2
  buf.writeUInt8(0, pos)
  pos += 1
  buf.writeUInt8(0, pos)
  pos += 1
  buf.writeUInt8(0, pos)
  pos += 1
  buf.writeUInt8(15, pos)
  pos += 1

  domainNameBytes.copy(buf, pos)
  pos += domainNameBytes.length
  usernameBytes.copy(buf, pos)
  pos += usernameBytes.length
  workstationBytes.copy(buf, pos)
  pos += workstationBytes.length
  lmChallengeResponse.copy(buf, pos)
  pos += lmChallengeResponse.length
  ntChallengeResponse.copy(buf, pos)
  pos += ntChallengeResponse.length
  encryptedSessionKeyBytes.copy(buf, pos)

  return 'NTLM ' + buf.toString('base64')
}
