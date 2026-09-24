// Locale resolution for the main process: explicit preference wins, else the
// system language. t() re-reads prefs on every call, so a language switch in
// the settings window applies to everything main produces afterwards.
import { app } from 'electron'
import { getPrefs } from './store'
import { createI18n, resolveLocale, type I18n, type Locale, type Params } from '../shared/i18n'

let cache: { locale: Locale; i18n: ReturnType<typeof createI18n> } | null = null

/** Effective locale: explicit preference, else the OS language. */
export function currentLocale(): Locale {
  return resolveLocale(getPrefs().lang, app.getLocale())
}

/** getI18n() cached until the resolved locale changes. */
export function getI18n(): ReturnType<typeof createI18n> {
  const locale = currentLocale()
  if (!cache || cache.locale !== locale) cache = { locale, i18n: createI18n(locale) }
  return cache.i18n
}

export function t(key: string, params?: Params): string {
  return getI18n().t(key, params)
}

export function tPlural(key: string, n: number, params?: Params): string {
  return getI18n().tPlural(key, n, params)
}
