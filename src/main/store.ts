import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createI18n, resolveLocale, type LangPref } from '../shared/i18n'

/** Non-personal preferences only — no calendar data ever lives here. */
export type Prefs = {
  leadMinutes: number
  messageTemplate: string
  soundEnabled: boolean
  staySignedIn: boolean
  launchAtLogin: boolean
  hideFromDock: boolean // menu-bar-only mode: no Dock icon, no Cmd+Tab
  targetDisplay: 'cursor' | 'primary'
  theme: string
  flier: string
  font: string
  // --- Pro ---
  speed: 'normal' | 'fast' | 'ultra' // how fast the rig crosses the screen
  flyAtStart: boolean // a second fly-by at the meeting's start time (free)
  soundPack: string // which signature sound plays mid-flight
  flierHead: string // character head id
  flierColor: string // plane colour id
  customFlierName: string // legacy (kept so old prefs files still parse)
  lang: LangPref // UI language: 'auto' = follow the system, else explicit
}

// Locale-independent defaults; only messageTemplate depends on the language.
const BASE_DEFAULTS = {
  leadMinutes: 5,
  soundEnabled: true,
  staySignedIn: true,
  launchAtLogin: false,
  hideFromDock: false,
  targetDisplay: 'cursor' as const,
  theme: 'classic',
  flier: 'duck-plane',
  font: 'system',
  speed: 'normal' as const,
  flyAtStart: false,
  soundPack: 'quack',
  flierHead: 'duck',
  flierColor: 'red',
  customFlierName: ''
}

function defaultPrefs(lang: LangPref): Prefs {
  const locale = resolveLocale(lang, app.getLocale())
  return {
    ...BASE_DEFAULTS,
    messageTemplate: createI18n(locale).t('banner.default'),
    lang
  }
}

function sanitizeLang(value: unknown): LangPref {
  return value === 'ru' || value === 'en' ? value : 'auto'
}

// Hard caps keep a hostile prefs.json (written through a compromised renderer)
// from bloating the file or smuggling long strings into the UI.
const MAX_TEMPLATE = 300
const MAX_ID = 50
const MAX_CUSTOM_NAME = 200

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function asString(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

/** Whitelist + type/range checks for anything arriving over IPC or from disk.
 * Unknown keys are dropped, numbers clamped, enums fall back, strings capped.
 * Field-by-field (not all-or-nothing) so a partial patch still applies. */
export function sanitizePrefs(patch: unknown): Partial<Prefs> {
  if (typeof patch !== 'object' || patch === null) return {}
  const raw = patch as Record<string, unknown>
  const out: Partial<Prefs> = {}

  if (typeof raw.leadMinutes === 'number' && Number.isFinite(raw.leadMinutes)) {
    out.leadMinutes = Math.min(60, Math.max(0, Math.round(raw.leadMinutes)))
  }
  if (typeof raw.messageTemplate === 'string') out.messageTemplate = raw.messageTemplate.slice(0, MAX_TEMPLATE)
  const soundEnabled = asBoolean(raw.soundEnabled)
  if (soundEnabled !== undefined) out.soundEnabled = soundEnabled
  const staySignedIn = asBoolean(raw.staySignedIn)
  if (staySignedIn !== undefined) out.staySignedIn = staySignedIn
  const launchAtLogin = asBoolean(raw.launchAtLogin)
  if (launchAtLogin !== undefined) out.launchAtLogin = launchAtLogin
  const hideFromDock = asBoolean(raw.hideFromDock)
  if (hideFromDock !== undefined) out.hideFromDock = hideFromDock
  const flyAtStart = asBoolean(raw.flyAtStart)
  if (flyAtStart !== undefined) out.flyAtStart = flyAtStart
  const targetDisplay = asEnum(raw.targetDisplay, ['cursor', 'primary'] as const)
  if (targetDisplay !== undefined) out.targetDisplay = targetDisplay
  const speed = asEnum(raw.speed, ['normal', 'fast', 'ultra'] as const)
  if (speed !== undefined) out.speed = speed
  const theme = asString(raw.theme, MAX_ID)
  if (theme !== undefined) out.theme = theme
  const flier = asString(raw.flier, MAX_ID)
  if (flier !== undefined) out.flier = flier
  const font = asString(raw.font, MAX_ID)
  if (font !== undefined) out.font = font
  const soundPack = asString(raw.soundPack, MAX_ID)
  if (soundPack !== undefined) out.soundPack = soundPack
  const flierHead = asString(raw.flierHead, MAX_ID)
  if (flierHead !== undefined) out.flierHead = flierHead
  const flierColor = asString(raw.flierColor, MAX_ID)
  if (flierColor !== undefined) out.flierColor = flierColor
  const customFlierName = asString(raw.customFlierName, MAX_CUSTOM_NAME)
  if (customFlierName !== undefined) out.customFlierName = customFlierName
  const lang = asEnum(raw.lang, ['auto', 'ru', 'en'] as const)
  if (lang !== undefined) out.lang = lang

  return out
}

function dataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}
const prefsPath = (): string => join(dataDir(), 'prefs.json')
const tokenPath = (): string => join(dataDir(), 'token.bin')
const icloudPath = (): string => join(dataDir(), 'icloud.bin')
const exchangePath = (): string => join(dataDir(), 'exchange.bin')
const googleCredsPath = (): string => join(dataDir(), 'google-creds.bin')
const icalPath = (): string => join(dataDir(), 'ical-feeds.bin')
// The user's own plane image, kept as a ready-to-render data URL (not sensitive).
const customFlierPath = (): string => join(dataDir(), 'custom-flier.txt')

let cache: Prefs | null = null

export function getPrefs(): Prefs {
  if (cache) return cache
  let raw: Partial<Prefs> = {}
  try {
    if (existsSync(prefsPath())) {
      raw = JSON.parse(readFileSync(prefsPath(), 'utf8')) as Partial<Prefs>
    }
  } catch {
    raw = {}
  }
  // Defaults (with a localized banner template) sit underneath whatever was
  // saved — an existing user's messageTemplate is NEVER rewritten. The saved
  // file is sanitized too: it may predate the whitelist (or be tampered with).
  cache = { ...defaultPrefs(sanitizeLang(raw.lang)), ...sanitizePrefs(raw) }
  return cache as Prefs
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next: Prefs = { ...getPrefs(), ...sanitizePrefs(patch) }
  cache = next
  try {
    writeFileSync(prefsPath(), JSON.stringify(next, null, 2), 'utf8')
  } catch {
    /* preferences are best-effort */
  }
  return next
}

// --- OAuth refresh token: encrypted at rest by the OS, and entirely optional ---

export function saveRefreshToken(token: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(tokenPath(), safeStorage.encryptString(token))
  } catch {
    /* ignore */
  }
}

export function loadRefreshToken(): string | null {
  try {
    if (!existsSync(tokenPath()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(tokenPath()))
  } catch {
    return null
  }
}

export function clearRefreshToken(): void {
  try {
    if (existsSync(tokenPath())) rmSync(tokenPath())
  } catch {
    /* ignore */
  }
}

// --- iCloud CalDAV credentials: Apple ID + app-specific password, encrypted ---

export function saveICloud(json: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(icloudPath(), safeStorage.encryptString(json))
  } catch {
    /* ignore */
  }
}

export function loadICloud(): string | null {
  try {
    if (!existsSync(icloudPath()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(icloudPath()))
  } catch {
    return null
  }
}

export function clearICloud(): void {
  try {
    if (existsSync(icloudPath())) rmSync(icloudPath())
  } catch {
    /* ignore */
  }
}

// --- Exchange (on-prem) credentials: EWS endpoint + Windows login, encrypted ---

export function saveExchange(json: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(exchangePath(), safeStorage.encryptString(json))
  } catch {
    /* ignore */
  }
}

export function loadExchange(): string | null {
  try {
    if (!existsSync(exchangePath()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(exchangePath()))
  } catch {
    return null
  }
}

export function clearExchange(): void {
  try {
    if (existsSync(exchangePath())) rmSync(exchangePath())
  } catch {
    /* ignore */
  }
}

// --- Google OAuth client (clientId/secret), pasted in-app, encrypted ---

export function saveGoogleCreds(json: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(googleCredsPath(), safeStorage.encryptString(json))
  } catch {
    /* ignore */
  }
}

export function loadGoogleCreds(): string | null {
  try {
    if (!existsSync(googleCredsPath()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(googleCredsPath()))
  } catch {
    return null
  }
}

// --- iCal/ICS subscription links (list of feed URLs), encrypted ---

export function saveIcalFeeds(json: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(icalPath(), safeStorage.encryptString(json))
  } catch {
    /* ignore */
  }
}

export function loadIcalFeeds(): string | null {
  try {
    if (!existsSync(icalPath()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(icalPath()))
  } catch {
    return null
  }
}

// --- Custom flier image: the user's own plane picture, stored as a data URL ---
// It's a decorative asset the user chose, so it's not encrypted. It never leaves
// the device — the overlay reads it through the main process only.

export function saveCustomFlier(dataUrl: string): void {
  try {
    writeFileSync(customFlierPath(), dataUrl, 'utf8')
  } catch {
    /* ignore */
  }
}

export function loadCustomFlier(): string | null {
  try {
    if (!existsSync(customFlierPath())) return null
    return readFileSync(customFlierPath(), 'utf8')
  } catch {
    return null
  }
}

export function clearCustomFlier(): void {
  try {
    if (existsSync(customFlierPath())) rmSync(customFlierPath())
  } catch {
    /* ignore */
  }
}
