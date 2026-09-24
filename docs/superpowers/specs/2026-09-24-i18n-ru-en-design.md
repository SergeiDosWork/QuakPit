# Дизайн: мультиязычность (i18n) — русский и английский

- **Дата:** 2026-09-24
- **Статус:** согласовано с владельцем проекта (подход 1; автоопределение языка + ручной переключатель)
- **Область:** всё пользовательски видимое приложение (tray, окно настроек, overlay-баннер, апдейтер, диалоги, ошибки календарных провайдеров) + README.md + AGENTS.md

## 1. Цель и предпосылки

QuakPit — форк Quakpit от Ooble Studio. Сейчас все ~160 видимых строк захардкожены на английском, системы локализации нет (`grep i18n|locale|translat` по `src/` — пусто). Нужно: двухъязычный UI (en + ru) без разового «перевода поверх», с выбором языка пользователем.

Продуктовые обещания не меняются: без сервера/телеметрии; календарные данные только в памяти; sensitive-данные шифруются как раньше.

## 2. Утверждённые решения

1. **Подход 1 — собственный микро-i18n, без зависимостей.** TypeScript-каталоги, типобезопасность через рантайм-тест соответствия ключей, плюрализация ~15 строк кода. Не i18next (избыточен для ~160 строк и 2 языков), не коды ошибок через IPC (YAGNI для одноразовых сообщений).
2. **Выбор языка:** `auto` по умолчанию (системный язык: начинается с `ru` → русский, иначе английский) + ручной переключатель в Settings → General. Смена применяется сразу, без перезапуска.
3. **README.md** — полностью на русском, с разделом «Отличия от оригинала (форк)». Устаревшие Pro/Polar-секции исчезают при переписывании.
4. **Бренды не переводим:** Quakpit, Ooble Studio — латиницей. Заголовок окна настроек `'Quakpit'` — бренд, не переводится.
5. Комментарии в коде остаются на английском (AGENTS.md обновляется: UI — en+ru).

## 3. Архитектура

### 3.1. Структура

```
src/shared/i18n/
  index.ts       # публичный экспорт: createI18n, resolveLocale, каталоги, типы
  core.ts        # ядро: типы, resolveLocale, createI18n, правила плюрализации
  en.ts          # английский каталог (плоские ключи, источник истины)
  ru.ts          # русский каталог
  plurals.ts     # таблица плюраформ: ключ → [формы]
  i18n.test.ts   # тесты ядра
  catalogs.test.ts
src/main/i18n.ts # тонкая обёртка main-процесса (locale из prefs + app.getLocale())
```

Общий tsconfig покрывает `src/**` целиком, `moduleResolution: Bundler` — относительные импорты из `src/shared/` работают и в main-, и в renderer-бандлах (renderer root — `src/renderer`, но Vite разрешает импорты за пределами root в пределах проекта).

### 3.2. Ядро (`core.ts`)

```ts
export type Locale = 'en' | 'ru'
export type LangPref = 'auto' | Locale
export type Params = Record<string, string | number>

/** pref: значение из prefs.lang; system: app.getLocale() / navigator.language */
export function resolveLocale(pref: LangPref | undefined, system: string): Locale
// 'ru' → 'ru'; 'en' → 'en'; 'auto'/undefined → system.toLowerCase().startsWith('ru') ? 'ru' : 'en'

export type I18n = {
  locale: Locale
  t: (key: string, params?: Params) => string
  tPlural: (key: string, n: number, params?: Params) => string
}
export function createI18n(locale: Locale): I18n
```

- `t`: поиск в каталоге локали; отсутствует → фолбэк на `en`; отсутствует и там → вернуть сам ключ (дыра видна в UI и ловится тестом каталогов).
- `tPlural(key, n, params)`: индекс формы по правилам локали, затем подстановка из `plurals.ts` с интерполяцией `{n}` и остальных params.
  - en: `n === 1 ? 0 : 1` (формы `_one`, `_other`).
  - ru: `n % 10 === 1 && n % 100 !== 11 ? 0 : [2,3,4].includes(n % 10) && !(n % 100 >= 12 && n % 100 <= 14) ? 1 : 2` (формы `_one`, `_few`, `_many`).
- Интерполяция: `{name}` → `String(params.name)`, без экранирования (все потребители — textContent/dialog).

### 3.3 Каталоги

Плоские ключи, сегменты camelCase. Семейства:

- `tray.*` — tooltip, «Open Quakpit», «Send a test flight (⌘⇧D)», «Quit Quakpit»
- `settings.*` — табы, заголовки секций, лейблы, подсказки, placeholder'ы, бейджи («easiest», «Soon»), статусы («Connected», «Not connected»), кнопки процессов («Adding…», «Connect»), пустые состояния, приватность-строка, селект языка
- `option.*` — имена опций: `option.flier.duck`, `option.color.red`, `option.theme.classic`, `option.font.{system|rounded|serif|mono|condensed}`, `option.sound.duck`, `option.fontPreview` («Hello» → «Привет»)
- `provider.google.*`, `provider.icloud.*`, `provider.ical.*`, `provider.exchange.*`, `provider.ews.*` — все ошибки подключения (~45 строк) и имена провайдеров
- `calendar.*` — фасад (`Unknown provider…`, `Cannot configure provider…`)
- `event.untitled` — фолбэк-название встречи (4 места)
- `updater.*` — «Update available», текст, «Restart now» / «Later»
- `dialog.*` — «Choose a plane image», «Images»
- `demo.*` — «Call with Jack in 5 minutes», `scheduler.startingNow` («{title} starting now»)
- `banner.default` — дефолтный шаблон баннера (см. 4.2)
- `ical.feeds` — единственная плюрализация: `{n} календарь/календаря/календарей` / `{n} calendar(s)`

Полный состав ключей перечисляется в плане внедрения (следующий шаг, через writing-plans) на основе проведённой инвентаризации строк (~160 позиций), каталоги наполняются в коммите №1.

### 3.4 Разметка HTML (окно настроек)

К статическим элементам `src/renderer/settings/index.html` добавляются атрибуты, английский текст остаётся в разметке как фолбэк:

- `data-i18n="key"` → `textContent`
- `data-i18n-placeholder="key"` → `placeholder`
- `data-i18n-title="key"` → `title` (тултипы) и `aria-label`

`applyI18n(root: Document, i18n: I18n)` (в `src/renderer/settings/i18n-apply.ts`) обходит `[data-i18n], [data-i18n-placeholder], [data-i18n-title]`. Динамические строки `settings.ts` (статусы, списки, кнопки, ошибки) переводятся в местах генерации через тот же `i18n`.

### 3.5 Поток локали

- **Main:** `src/main/i18n.ts` — на каждый вызов `resolveLocale(getPrefs().lang, app.getLocale())`, `createI18n` кэшируется по локали. Все строки main (tray, updater, диалоги, scheduler, демо, ошибки провайдеров, имена провайдеров) — через `t()`.
- **Renderer (settings):** при старте `getPrefs()` (существующий мост `window.quakpit.getPrefs`, `prefs:get`) → `resolveLocale(prefs.lang, navigator.language)` → `createI18n` → `applyI18n` + перерисовка динамических списков.
- **Смена языка:** селект в General (`auto | ru | en`) → `setPrefs({ lang })` → локально пересоздать `i18n` и применить снова (окно перезапускать не нужно); в main обработчик `prefs:set` (`src/main/ipc.ts:29`) при `patch.lang !== undefined` вызывает `rebuildTray()`.
- **Overlay:** изменений нет — текст баннера приходит из main уже переведённым (`flight.message`).
- **Новый IPC не добавляется** — контракт `ipc.ts`/`preload`/`quakpit.d.ts` не меняется.

### 3.6 Trей: пересборка

`src/main/tray.ts` хранит колбэки в module-level переменных; `rebuildTray()` обновляет `tray.setToolTip(...)` и `tray.setContextMenu(Menu.buildFromTemplate(...))` на существующем экземпляре (иконка не пересоздаётся).

## 4. Краевые случаи

### 4.1 Существующие пользователи

- `prefs.json` не содержит `lang` → `'auto'` (merge с `DEFAULT_PREFS` уже это покрывает).
- `messageTemplate` уже записан у существующих пользователей — **не перезаписываем**; локализованный дефолт видят только новые установки.
- `DEFAULT_PREFS` в `store.ts` превращается в `defaultPrefs(locale)`: `getPrefs()` при отсутствии файла/ключа подставляет `banner.default` для `resolveLocale(undefined, app.getLocale())`. Остальные дефолты от локали не зависят.

### 4.2 Шаблон баннера

`{title}` / `{minutes}` — пользовательские токены, не i18n-ключи. Дефолт: en `{title} in {minutes} minutes`, ru `{title} через {minutes} мин` («мин» — неизменяемое, плюрализация в шаблоне не нужна).

### 4.3 Ошибки

- Ошибка, уже показанная в UI, не переключает язык при смене локали — она одноразовая; статусы провайдеров перегенерируются при каждом опросе и подхватывают язык сами.
- `MessageText` от Exchange-сервера Microsoft (`ews.ts` `findItemError`) — серверный текст, **не переводим**, прокидываем как есть.
- Подробности ошибок Google OAuth (`Token exchange failed (${res.status})` и т.п.) переводим целиком в каталог, статус-код — параметром.

## 5. Вне области (зафиксировано)

- `site/` — статический лендинг, не входит в сборку приложения (проверено: `electron.vite.config.ts` собирает только overlay+settings, `electron-builder.yml` пакует только `out/**`).
- Фон DMG-установщика (`build/dmg-background.png`) — статичный PNG с впаянным английским текстом; известное ограничение, перерисовка отдельно.
- `package.json` `name`/`productName`, имена артефактов (`Quakpit.dmg`), копирайт — не меняются. `description` в `package.json` делается двуязычным одной строкой (ru + en).
- Комментарии в коде — остаются на английском.

## 6. Тесты (vitest, рядом с исходниками)

`src/shared/i18n/i18n.test.ts`:
- `resolveLocale`: явные `'ru'`/`'en'`; `'auto'` + `ru-RU`/`ru` → ru; `en-US` → en; неизвестная локаль (`de-DE`) → en; `undefined` + системная → en.
- `t`: интерполяция `{title}`/`{minutes}`; фолбэк на en при отсутствии ключа в ru (специальный fixture-каталог); ключ отсутствует в обоих → возвращается сам ключ.
- `tPlural`: ru — 1/21/101 → форма `_one`, 2–4/22–24 → форма `_few`, 5–20/11–14 → форма `_many`; en — 1 → `_one`, остальное → `_other`.

`src/shared/i18n/catalogs.test.ts`:
- наборы ключей `ru` и `en` идентичны (1-в-1, включая вложенность плоских имён);
- плейсхолдеры каждого ru-значения совпадают с en-значением того же ключа (при переводе не потеряны `{title}`, `{minutes}`, `{n}`);
- каждая запись `plurals.ts` имеет ровно 2 en-формы и 3 ru-формы.

## 7. README.md и AGENTS.md

**README.md** — полная переработка на русском:

1. Лого, описание, бейджи (MIT, macOS)
2. **«Отличия от оригинала»** — что сделано в форке после `7e7b54b` (оригинал: Quakpit от Ooble Studio, автор TomFromOoble):
   - провайдер Microsoft Exchange (on-premises) по EWS (`dce004b`);
   - полное удаление Pro/лицензирования — всё бесплатно (MIT, `0265c35`);
   - режим «скрыть иконку из Dock» + иконка трея из артворка приложения (`8456bbc`);
   - i18n: русский и английский интерфейс (это изменение).
3. Как работает (4 провайдера календарей, ⌘⇧D)
4. Приватность: без сервера, события только в памяти
5. Установка (Releases)
6. Подключение календарей: iCal-ссылки, iCloud, Exchange, Google (OAuth-инструкция)
7. Разработка (команды, `ELECTRON_RUN_AS_NODE`)
8. Сборка macOS (dist:mac, нотаризация)
9. Структура проекта
10. Лицензия MIT + благодарность оригинальному автору (Ooble Studio, ooble.studio)

**AGENTS.md:** строка «UI and code comments are English» заменяется на «UI: English + Russian via i18n (`src/shared/i18n/` — все видимые строки только из каталогов; code comments English».

## 8. Порядок внедрения

1. **Ядро + каталоги + тесты** (TDD: сначала тесты ядра) — `src/shared/i18n/*`, перевод всех ~160 строк из инвентаризации.
2. **Окно настроек** — `data-i18n`-разметка, `applyI18n`, динамические строки `settings.ts`, имена опций из каталогов.
3. **Main-процесс** — `src/main/i18n.ts`, ошибки провайдеров, имена провайдеров, tray (+`rebuildTray`), updater, диалоги, scheduler/demo, `defaultPrefs(locale)`.
4. **Селект языка** — General-таб, пересборка трея при смене.
5. **README.md + AGENTS.md**.
6. **Проверка:** `npx tsc --noEmit && npm test` (CI тесты не запускает — прогон обязателен локально), ручной smoke-запуск (`env -u ELECTRON_RUN_AS_NODE npm run dev` — из терминала пользователя).

## 9. Открытые вопросы

Нет.
