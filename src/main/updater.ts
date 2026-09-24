import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { t } from './i18n'

const CHECK_INTERVAL = 6 * 60 * 60 * 1000

// Set true to make updates mandatory (no "Later" — the app restarts to update).
const FORCE_UPDATE = false

/**
 * Checks GitHub Releases for updates, downloads them in the background, and
 * prompts the user to restart. No-ops in development, and on macOS only works
 * for a SIGNED + notarized build (Squirrel.Mac requirement).
 * The release feed comes from the `publish:` block in electron-builder.yml.
 */
export function initAutoUpdate(): void {
  if (!app.isPackaged) return

  try {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-downloaded', (info) => {
      const restartLabel = t('updater.restartNow')
      const laterLabel = t('updater.later')
      const buttons = FORCE_UPDATE ? [restartLabel] : [restartLabel, laterLabel]
      void dialog
        .showMessageBox({
          type: 'info',
          buttons,
          defaultId: 0,
          cancelId: FORCE_UPDATE ? 0 : 1,
          title: t('updater.title'),
          message: t('updater.ready', { version: info.version }),
          detail: FORCE_UPDATE ? t('updater.detail.required') : t('updater.detail.optional')
        })
        .then((r) => {
          if (FORCE_UPDATE || r.response === 0) autoUpdater.quitAndInstall()
        })
    })

    autoUpdater.on('error', () => undefined)

    void autoUpdater.checkForUpdates().catch(() => undefined)
    setInterval(() => {
      void autoUpdater.checkForUpdates().catch(() => undefined)
    }, CHECK_INTERVAL)
  } catch {
    // Updates are best-effort; never block the app over them.
  }
}
