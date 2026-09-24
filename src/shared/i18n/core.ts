// Minimal i18n core shared by the main process and both renderers.
// NO Electron imports here — this file must stay unit-testable in plain vitest.

export type Locale = 'en' | 'ru'
export type LangPref = 'auto' | Locale
export type Params = Record<string, string | number>
export type Dict = Record<string, string>
export type Catalogs = Record<Locale, Dict>
export type PluralForms = { en: [string, string]; ru: [string, string, string] }
export type PluralTable = Record<string, PluralForms>

export type I18n = {
  locale: Locale
  t: (key: string, params?: Params) => string
  tPlural: (key: string, n: number, params?: Params) => string
}

/** Resolves the effective locale from a user preference and the system locale. */
export function resolveLocale(pref: LangPref | undefined, system: string): Locale {
  if (pref === 'ru' || pref === 'en') return pref
  return system.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

/** Picks the plural form index: en = [one, other]; ru = [one, few, many]. */
export function pluralIndex(locale: Locale, n: number): number {
  if (locale === 'en') return n === 1 ? 0 : 1
  const mod100 = Math.abs(Math.trunc(n)) % 100
  const mod10 = mod100 % 10
  if (mod10 === 1 && mod100 !== 11) return 0
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 1
  return 2
}

function interpolate(template: string, params: Params | undefined): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  )
}

/** Creates a translator bound to a locale. Missing keys fall back to en, then to the key. */
export function createI18n(locale: Locale, catalogs: Catalogs, plurals: PluralTable): I18n {
  const dict = catalogs[locale] ?? catalogs.en
  const t = (key: string, params?: Params): string =>
    interpolate(dict[key] ?? catalogs.en[key] ?? key, params)
  const tPlural = (key: string, n: number, params?: Params): string => {
    const forms = plurals[key]
    const form = forms ? forms[locale][pluralIndex(locale, n)] : (dict[key] ?? catalogs.en[key] ?? key)
    return interpolate(form, { ...params, n })
  }
  return { locale, t, tPlural }
}
