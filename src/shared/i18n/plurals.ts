import type { PluralTable } from './core'

/**
 * Plural-form templates, keyed like dict entries. en has [one, other] forms,
 * ru has [one, few, many] — index selection lives in core.pluralIndex().
 */
export const plurals: PluralTable = {
  'ical.feeds': {
    en: ['{n} calendar', '{n} calendars'],
    ru: ['{n} календарь', '{n} календаря', '{n} календарей']
  }
}
