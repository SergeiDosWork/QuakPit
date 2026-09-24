// Applies catalog strings to the static settings markup.
//   data-i18n="key"        → textContent (plain text; never put SVG inside these elements)
//   data-i18n-html="key"   → innerHTML (trusted static catalog markup only: <b>, <a>)
//   data-i18n-placeholder  → input placeholder
//   data-i18n-title        → title + aria-label (icon-only buttons)
import type { I18n } from '../../shared/i18n'

export function applyI18n(root: Document, i18n: I18n): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = i18n.t(el.dataset.i18n as string)
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = i18n.t(el.dataset.i18nHtml as string)
  })
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = i18n.t(el.dataset.i18nPlaceholder as string)
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const text = i18n.t(el.dataset.i18nTitle as string)
    el.title = text
    el.setAttribute('aria-label', text)
  })
}
