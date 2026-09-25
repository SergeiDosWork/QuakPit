import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Prefs } from './store'

// The store persists to <userData>/prefs.json, where userData comes from
// Electron's app.getPath. Point it at a throwaway directory per test so the
// real file I/O is exercised without touching a real user profile.
vi.mock('electron', () => ({
  app: { getPath: () => currentDir, getLocale: () => 'en' },
  safeStorage: { isEncryptionAvailable: () => false }
}))

let currentDir = ''

beforeEach(() => {
  currentDir = mkdtempSync(join(tmpdir(), 'quakpit-prefs-'))
  vi.resetModules() // fresh module => fresh in-memory prefs cache
})

afterEach(() => {
  rmSync(currentDir, { recursive: true, force: true })
})

describe('prefs', () => {
  it('defaults hideFromDock to false', async () => {
    const store = await import('./store')
    expect(store.getPrefs().hideFromDock).toBe(false)
  })

  it('persists hideFromDock and reads it back from disk', async () => {
    const store = await import('./store')
    store.setPrefs({ hideFromDock: true })

    // Re-import from scratch: the in-memory cache is gone, so this only
    // passes if the value really reached prefs.json on disk.
    vi.resetModules()
    const reloaded = await import('./store')
    expect(reloaded.getPrefs().hideFromDock).toBe(true)
  })
})

describe('prefs sanitization (ipc boundary)', () => {
  it('drops keys that are not part of Prefs', async () => {
    const store = await import('./store')
    store.setPrefs({ evilKey: 'pwn' } as never)
    const raw = JSON.parse(readFileSync(join(currentDir, 'prefs.json'), 'utf8')) as Record<string, unknown>
    expect(raw).not.toHaveProperty('evilKey')
  })

  it('clamps leadMinutes into the 0..60 range', async () => {
    const store = await import('./store')
    store.setPrefs({ leadMinutes: 9999 })
    expect(store.getPrefs().leadMinutes).toBe(60)
    vi.resetModules()

    const store2 = await import('./store')
    store2.setPrefs({ leadMinutes: -5 })
    expect(store2.getPrefs().leadMinutes).toBe(0)
    vi.resetModules()

    const store3 = await import('./store')
    store3.setPrefs({ leadMinutes: Number.NaN })
    expect(store3.getPrefs().leadMinutes).toBe(0) // NaN is dropped → the persisted 0 stays (never NaN/null on disk)
  })

  it('drops values of the wrong type instead of persisting them', async () => {
    const store = await import('./store')
    store.setPrefs({
      soundEnabled: 'yes' as unknown as boolean,
      launchAtLogin: 1 as unknown as boolean,
      targetDisplay: 'both' as unknown as 'cursor' | 'primary',
      speed: 'warp' as unknown as Prefs['speed'],
      theme: 42 as unknown as string
    } as Partial<Prefs>)
    const prefs = store.getPrefs()
    expect(prefs.soundEnabled).toBe(true) // default kept
    expect(prefs.launchAtLogin).toBe(false)
    expect(prefs.targetDisplay).toBe('cursor')
    expect(prefs.speed).toBe('normal')
    expect(prefs.theme).toBe('classic')
  })

  it('caps the length of string preferences', async () => {
    const store = await import('./store')
    store.setPrefs({ messageTemplate: 'A'.repeat(10_000), theme: 'T'.repeat(500) })
    expect(store.getPrefs().messageTemplate.length).toBeLessThanOrEqual(300)
    expect(store.getPrefs().theme.length).toBeLessThanOrEqual(50)
  })

  it('sanitizes what is read back from a poisoned prefs.json', async () => {
    const store = await import('./store')
    writeFileSync(join(currentDir, 'prefs.json'), JSON.stringify({ evilKey: 'x', leadMinutes: 999, lang: 'ru' }))
    vi.resetModules()
    const reloaded = await import('./store')
    const prefs = reloaded.getPrefs()
    expect(prefs.leadMinutes).toBe(60)
    expect(prefs.lang).toBe('ru')
    expect((prefs as unknown as Record<string, unknown>).evilKey).toBeUndefined()
  })
})
