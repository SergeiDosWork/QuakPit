import { describe, expect, it } from 'vitest'
import { en } from './en'
import { plurals } from './plurals'
import { ru } from './ru'

const PLACEHOLDER = /\{(\w+)\}/g

const tokens = (s: string): string[] =>
  [...s.matchAll(PLACEHOLDER)].map((m) => m[1]).sort()

describe('catalogs', () => {
  it('ru has exactly the same keys as en', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
  })

  it('ru keeps every placeholder from en', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(tokens(ru[key] ?? ''), key).toEqual(tokens(value))
    }
  })

  it('plurals: 2 en forms and 3 ru forms', () => {
    expect(Object.keys(plurals).length).toBeGreaterThan(0)
    for (const forms of Object.values(plurals)) {
      expect(forms.en).toHaveLength(2)
      expect(forms.ru).toHaveLength(3)
    }
  })
})
