import { app, dialog, ipcMain, shell } from 'electron'
import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import {
  getPrefs,
  setPrefs,
  type Prefs,
  saveCustomFlier,
  loadCustomFlier,
  clearCustomFlier
} from './store'
import * as google from './calendar/google'
import * as calendar from './calendar'
import * as license from './license'
import { flyAcross } from './windows/overlay'
import { startScheduler } from './scheduler'

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

const FREE_CAL_MSG =
  'The free plan supports one calendar. Upgrade to Quakpit Pro to add more calendars.'

/** How many calendars are connected across all providers (iCal feeds + account providers). */
function calendarCount(): number {
  return calendar.icalFeeds().length + calendar.statuses().filter((s) => s.connected).length
}

/** Wires the settings renderer to the main process. */
export function registerIpc(): void {
  ipcMain.handle('prefs:get', () => getPrefs())

  ipcMain.handle('prefs:set', (_e, patch: Partial<Prefs>) => {
    const prefs = setPrefs(patch)
    if (patch.launchAtLogin !== undefined && app.isPackaged) {
      try {
        app.setLoginItemSettings({ openAtLogin: patch.launchAtLogin })
      } catch {
        /* ignore: not permitted in dev / sandboxed runs */
      }
    }
    if (patch.staySignedIn === true) google.persistIfPossible()
    if (patch.staySignedIn === false) google.forgetPersisted()
    return prefs
  })

  // --- Calendars (multi-provider: Google, iCloud, …) ---
  ipcMain.handle('cal:status', () => calendar.statuses())

  ipcMain.handle(
    'cal:connect',
    async (_e, provider: string, params: { username?: string; password?: string; serverUrl?: string }) => {
      // Free plan = a single calendar. Reconnecting the same source is still allowed.
      const statuses = calendar.statuses()
      const same = statuses.find((s) => s.id === provider)?.connected ?? false
      if (!license.isPremium() && calendarCount() >= 1 && !same) throw new Error(FREE_CAL_MSG)
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
    // Free plan = a single calendar across all providers.
    if (!license.isPremium() && calendarCount() >= 1) throw new Error(FREE_CAL_MSG)
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
      message: 'Call with Jack in 5 minutes',
      durationMs: 9000,
      sound: prefs.soundEnabled
    })
    return true
  })

  // --- Custom flier image (Pro): the user's own plane picture, stored locally ---
  ipcMain.handle('flier:import', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose a plane image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
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

  // --- License / premium ---
  ipcMain.handle('license:status', () => license.status())
  ipcMain.handle('license:activate', (_e, key: string) => license.activate(key))
  ipcMain.handle('license:deactivate', () => license.deactivate())
}
