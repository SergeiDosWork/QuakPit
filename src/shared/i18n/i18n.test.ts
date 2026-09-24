import { describe, expect, it } from 'vitest'
import { createI18n, pluralIndex, resolveLocale, type Catalogs, type PluralTable } from './core'

const catalogs: Catalogs = {
  en: { 'greet.hello': 'Hello {name}!', 'only.en': 'English only' },
  ru: { 'greet.hello': 'Привет, {name}!' }
}
const plurals: PluralTable = {
  'test.count': {
    en: ['{n} item', '{n} items'],
    ru: ['{n} предмет', '{n} предмета', '{n} предметов']
  }
}

describe('resolveLocale', () => {
  it('returns explicit preferences', () => {
    expect(resolveLocale('ru', 'en-US')).toBe('ru')
    expect(resolveLocale('en', 'ru-RU')).toBe('en')
  })
  it('auto-detects Russian system locales', () => {
    expect(resolveLocale('auto', 'ru-RU')).toBe('ru')
    expect(resolveLocale('auto', 'ru')).toBe('ru')
  })
  it('falls back to English for other/unknown locales', () => {
    expect(resolveLocale('auto', 'en-US')).toBe('en')
    expect(resolveLocale('auto', 'de-DE')).toBe('en')
    expect(resolveLocale(undefined, 'en-US')).toBe('en')
  })
})

describe('pluralIndex', () => {
  it('english: one vs other', () => {
    expect(pluralIndex('en', 1)).toBe(0)
    expect(pluralIndex('en', 2)).toBe(1)
    expect(pluralIndex('en', 0)).toBe(1)
  })
  it('russian: one/few/many with 11-14 edge cases', () => {
    for (const n of [1, 21, 101]) expect(pluralIndex('ru', n)).toBe(0)
    for (const n of [2, 3, 4, 22, 24]) expect(pluralIndex('ru', n)).toBe(1)
    for (const n of [0, 5, 11, 12, 14, 20, 25, 111]) expect(pluralIndex('ru', n)).toBe(2)
  })
})

describe('t', () => {
  it('interpolates params', () => {
    expect(createI18n('en', catalogs, plurals).t('greet.hello', { name: 'Jack' })).toBe('Hello Jack!')
    expect(createI18n('ru', catalogs, plurals).t('greet.hello', { name: 'Даша' })).toBe('Привет, Даша!')
  })
  it('falls back to English, then to the key itself', () => {
    expect(createI18n('ru', catalogs, plurals).t('only.en')).toBe('English only')
    expect(createI18n('ru', catalogs, plurals).t('nope.missing')).toBe('nope.missing')
  })
  it('keeps unknown placeholders as-is', () => {
    expect(createI18n('en', catalogs, plurals).t('greet.hello', { other: 'x' })).toBe('Hello {name}!')
  })
})

describe('tPlural', () => {
  it('picks the right russian form and interpolates {n}', () => {
    const ru = createI18n('ru', catalogs, plurals)
    expect(ru.tPlural('test.count', 1)).toBe('1 предмет')
    expect(ru.tPlural('test.count', 3)).toBe('3 предмета')
    expect(ru.tPlural('test.count', 11)).toBe('11 предметов')
    expect(ru.tPlural('test.count', 21)).toBe('21 предмет')
  })
  it('picks the right english form', () => {
    const en = createI18n('en', catalogs, plurals)
    expect(en.tPlural('test.count', 1)).toBe('1 item')
    expect(en.tPlural('test.count', 5)).toBe('5 items')
  })
})
