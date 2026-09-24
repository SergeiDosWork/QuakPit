import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

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
