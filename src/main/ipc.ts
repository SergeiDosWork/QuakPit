import { app, dialog, ipcMain, shell } from 'electron'
import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import {
  getPrefs,
  setPrefs,
  sanitizePrefs,
  type Prefs,
  saveCustomFlier,
  loadCustomFlier,
  clearCustomFlier
} from './store'
import * as google from './calendar/google'
import * as calendar from './calendar'
import { flyAcross } from './windows/overlay'
import { startScheduler } from './scheduler'
import { t } from './i18n'
import { rebuildTray } from './tray'

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

/** Wires the settings renderer to the main process. */
export function registerIpc(): void {
  ipcMain.handle('prefs:get', () => getPrefs())

  ipcMain.handle('prefs:set', (_e, patch: Partial<Prefs>) => {
    // The renderer is untrusted: only whitelisted, type-checked fields survive.
    const clean = sanitizePrefs(patch)
    const prefs = setPrefs(clean)
    if (clean.launchAtLogin !== undefined && app.isPackaged) {
      try {
        app.setLoginItemSettings({ openAtLogin: clean.launchAtLogin })
      } catch {
        /* ignore: not permitted in dev / sandboxed runs */
      }
    }
    if (clean.hideFromDock !== undefined && process.platform === 'darwin') {
      if (clean.hideFromDock) void app.dock?.hide()
      else void app.dock?.show()
    }
    if (clean.staySignedIn === true) google.persistIfPossible()
    if (clean.staySignedIn === false) google.forgetPersisted()
    if (clean.lang !== undefined) rebuildTray()
    return prefs
  })

  // --- Calendars (multi-provider: Google, iCloud, Exchange, iCal links) ---
  ipcMain.handle('cal:status', () => calendar.statuses())

  ipcMain.handle(
    'cal:connect',
    async (_e, provider: string, params: { username?: string; password?: string; serverUrl?: string }) => {
      const s = await calendar.connect(provider, params ?? {})
      startScheduler()
      return s
    }
  )

  ipcMain.handle('cal:disconnect', (_e, provider: string) => calendar.disconnect(provider))

  ipcMain.handle(
    'cal:configure',
    (_e, provider: string, params: { clientId?: string; clientSecret?: string }) =>
      calendar.configure(provider, params ?? {})
  )

  // iCal subscription links
  ipcMain.handle('ical:list', () => calendar.icalFeeds())
  ipcMain.handle('ical:add', async (_e, url: string, name?: string) => {
    const feeds = await calendar.icalAdd(url, name)
    startScheduler()
    return feeds
  })
  ipcMain.handle('ical:remove', (_e, id: string) => calendar.icalRemove(id))

  ipcMain.handle('events:upcoming', async () => {
    try {
      return await calendar.listUpcoming(120)
    } catch {
      return []
    }
  })

  // Open a link (checkout, help) in the user's real browser, not an app window.
  ipcMain.handle('open:external', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })

  ipcMain.handle('flight:test', () => {
    const prefs = getPrefs()
    flyAcross({
      message: t('demo.message'),
      durationMs: 9000,
      sound: prefs.soundEnabled
    })
    return true
  })

  // --- Custom flier image (Pro): the user's own plane picture, stored locally ---
  ipcMain.handle('flier:import', async () => {
    const res = await dialog.showOpenDialog({
      title: t('dialog.chooseImage'),
      properties: ['openFile'],
      filters: [{ name: t('dialog.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    const file = res.filePaths[0]
    if (res.canceled || !file) return { prefs: getPrefs(), dataUrl: loadCustomFlier() }
    const mime = IMAGE_MIME[extname(file).toLowerCase()] ?? 'image/png'
    const dataUrl = `data:${mime};base64,${readFileSync(file).toString('base64')}`
    saveCustomFlier(dataUrl)
    const prefs = setPrefs({ customFlierName: basename(file), flier: 'custom' })
    return { prefs, dataUrl }
  })

  ipcMain.handle('flier:getCustom', () => loadCustomFlier())

  ipcMain.handle('flier:removeCustom', () => {
    clearCustomFlier()
    const wasCustom = getPrefs().flier === 'custom'
    return setPrefs({ customFlierName: '', ...(wasCustom ? { flier: 'duck-plane' } : {}) })
  })
}
