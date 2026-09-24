// Public i18n API. Everything user-visible must come from here — no hardcoded UI strings.
import { en } from './en'
import { ru } from './ru'
import { plurals } from './plurals'
import { createI18n as createCoreI18n, pluralIndex, resolveLocale, type Locale } from './core'

export { pluralIndex, resolveLocale }
export type {
  Catalogs,
  Dict,
  I18n,
  LangPref,
  Locale,
  Params,
  PluralForms,
  PluralTable
} from './core'
export { en } from './en'
export { ru } from './ru'
export { plurals } from './plurals'

/** Translator bound to the real en/ru catalogs. */
export function createI18n(locale: Locale): ReturnType<typeof createCoreI18n> {
  return createCoreI18n(locale, { en, ru }, plurals)
}
