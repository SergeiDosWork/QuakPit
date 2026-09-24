import type { Dict } from './core'

/** Russian strings. Key set must match en.ts exactly — enforced by catalogs.test.ts. */
export const ru: Dict = {
  // --- tray ---
  'tray.tooltip': 'Quakpit',
  'tray.open': 'Открыть Quakpit',
  'tray.testFlight': 'Отправить тестовый полёт  (⌘⇧D)',
  'tray.quit': 'Выйти из Quakpit',

  // --- settings chrome ---
  'settings.windowTitle': 'Quakpit — Настройки',
  'settings.tab.general': 'Основные',
  'settings.tab.appearance': 'Оформление',
  'settings.tab.calendar': 'Календарь',
  'settings.testFlight': 'Отправить тестовый полёт',
  'settings.presentedBy': 'От студии',

  // --- general tab ---
  'settings.general.subtitle': 'Когда и как прилетает утка.',
  'settings.reminders': 'Напоминания',
  'settings.lead.label': 'Время до встречи',
  'settings.lead.hint': 'За сколько до встречи вылетать',
  'settings.lead.5': '5 мин',
  'settings.lead.15': '15 мин',
  'settings.lead.30': '30 мин',
  'settings.flyAtStart.label': 'Повторить в начале встречи',
  'settings.flyAtStart.hint': 'Второй пролёт ровно в момент начала',
  'settings.banner.label': 'Текст баннера',
  'settings.banner.hint': 'Нажмите тег, чтобы вставить его',
  'settings.flight': 'Полёт',
  'settings.speed.label': 'Скорость',
  'settings.speed.hint': 'Как быстро самолёт пересекает экран',
  'settings.display.label': 'Показывать на',
  'settings.display.hint': 'Какой экран использует самолёт',
  'settings.display.cursor': 'Экран с курсором',
  'settings.display.primary': 'Основной экран',
  'settings.launch.label': 'Запускать при входе в систему',
  'settings.launch.hint': 'Запускать Quakpit вместе с macOS',
  'settings.hideDock.label': 'Скрывать значок из Dock',
  'settings.hideDock.hint': 'Приложение только в строке меню — открывайте Quakpit через значок в трее',
  'settings.stay.label': 'Оставаться в системе',
  'settings.stay.hint': 'Хранить токен календаря (зашифрованно)',
  'settings.language.label': 'Язык',
  'settings.language.hint': 'Применяется сразу, без перезапуска',
  'settings.language.auto': 'Авто — как в системе',

  // --- appearance tab ---
  'settings.appearance.subtitle': 'Настройте Quakpit под себя.',
  'settings.preview.banner': 'Встреча через 5 минут',
  'settings.sub.flier': 'Пилот',
  'settings.sub.banner': 'Баннер',
  'settings.sub.typo': 'Шрифт',
  'settings.sub.sound': 'Звук',
  'settings.flier.hint': 'Выберите голову, затем цвет самолёта.',
  'settings.flier.head': 'Голова',
  'settings.flier.color': 'Цвет самолёта',
  'settings.bannerTheme': 'Тема баннера',
  'settings.bannerTheme.hint': 'Цветные полосы буксируемого баннера.',
  'settings.typography': 'Типографика',
  'settings.typography.hint': 'Шрифт баннера.',
  'settings.engine.label': 'Звук двигателя',
  'settings.engine.hint': 'Мотор и звуки во время полёта',
  'settings.flightSound.label': 'Звук полёта',
  'settings.flightSound.hint': 'Зависит от выбранного животного — нажмите, чтобы прослушать',
  'option.fontPreview': 'Привет',

  // --- calendar tab ---
  'settings.calendar.subtitle': 'Читается только на этом устройстве — никуда не отправляется.',
  'settings.provider.byLink': 'Добавить по ссылке',
  'settings.badge.easiest': 'проще всего',
  'settings.provider.googleSoon': 'Вход скоро появится',
  'settings.badge.soon': 'Скоро',
  'settings.state.connected': 'Подключено',
  'settings.state.connectedDetail': 'Подключено · {detail}',
  'settings.state.connectedOk': '✅ Подключено',
  'settings.state.notConnected': 'Не подключено',
  'settings.nextUp': 'Ближайшие',
  'settings.nextUp.refreshTitle': 'Проверить календари прямо сейчас',
  'settings.upcoming.empty': 'В ближайшие пару часов встреч нет.',
  'settings.upcoming.connect': 'Подключите календарь, чтобы увидеть встречи.',
  'settings.privacy': '🔒 Всё остаётся на этом устройстве. У Quakpit нет сервера.',

  // --- wizards (shared actions) ---
  'settings.back': '‹ Назад',
  'settings.action.connect': 'Подключить',
  'settings.action.connecting': 'Подключаем…',
  'settings.action.disconnect': 'Отключить',
  'settings.action.remove': 'Удалить',

  // --- iCal-link wizard ---
  'settings.ical.title': 'Добавить календарь по ссылке',
  'settings.ical.cardTitle': 'Вставьте ссылку на календарь (iCal / .ics)',
  'settings.ical.step1':
    'Google Календарь (веб): откройте календарь → <b>Настройки и доступ</b> → <b>Интеграция календаря</b> → скопируйте <b>Секретный адрес в формате iCal</b>.',
  'settings.ical.step2': 'Outlook / Fastmail / другие: ищите <b>Публикация</b> или ссылку <b>iCal/ICS</b>.',
  'settings.ical.step3': 'Вставьте ссылку ниже — добавляйте столько календарей, сколько нужно.',
  'settings.ical.linkLabel': 'Ссылка на календарь',
  'settings.ical.urlPlaceholder': 'https://…/basic.ics  (или webcal://…)',
  'settings.ical.nameLabel': 'Название (необязательно)',
  'settings.ical.namePlaceholder': 'Работа',
  'settings.ical.add': 'Добавить календарь',
  'settings.ical.adding': 'Добавляем…',
  'settings.ical.feedsTitle': 'Ваши ссылки на календари',
  'settings.ical.none': 'Пока ничего нет.',

  // --- iCloud wizard ---
  'settings.icloud.title': 'Подключить Apple iCloud',
  'settings.icloud.cardTitle': 'Вход с паролем приложения',
  'settings.icloud.step1':
    'Откройте <a href="https://appleid.apple.com" target="_blank" rel="noopener">appleid.apple.com</a> → «Вход и безопасность» → <b>Пароли приложений</b> → создайте пароль.',
  'settings.icloud.step2': 'Введите ниже свой Apple ID и этот пароль.',
  'settings.icloud.appleId': 'Apple ID',
  'settings.icloud.appPassword': 'Пароль приложения',

  // --- Exchange wizard ---
  'settings.exchange.title': 'Подключить Microsoft Exchange',
  'settings.exchange.cardTitle': 'Подключение к корпоративному серверу Exchange',
  'settings.exchange.step1': 'Узнайте у IT адрес EWS — обычно <b>https://mail.company.com/EWS/Exchange.asmx</b>.',
  'settings.exchange.step2': 'Войдите с учётной записью Windows, например <b>CORP\\jane</b> или <b>jane@corp.com</b>.',
  'settings.exchange.step3': 'Сервер должен быть доступен — из офисной сети или через VPN.',
  'settings.exchange.server': 'Адрес сервера',
  'settings.exchange.serverPlaceholder': 'mail.company.com',
  'settings.exchange.username': 'Имя пользователя',
  'settings.exchange.userPlaceholder': 'CORP\\jane',
  'settings.exchange.password': 'Пароль',

  // --- option display names (looked up as `option.<group>.<id>`) ---
  'option.head.duck': 'Утка',
  'option.color.red': 'Красный',
  'option.theme.classic': 'Классика',
  'option.font.system': 'Системный',
  'option.font.rounded': 'Скруглённый',
  'option.font.serif': 'С засечками',
  'option.font.mono': 'Моноширинный',
  'option.font.condensed': 'Узкий',
  'option.sound.quack': 'Утка',

  // --- main → UI strings ---
  'demo.message': 'Звонок с Джеком через 5 минут',
  'scheduler.startingNow': '{title} начинается сейчас',
  'banner.default': '{title} через {minutes} мин',
  'event.untitled': 'Без названия',
  'calendar.google.name': 'Google Календарь',
  'calendar.ical.name': 'Ссылки на календари',
  'calendar.icloud.name': 'iCloud',
  'calendar.exchange.name': 'Exchange',
  'calendar.unknownProvider': 'Неизвестный провайдер: {id}',
  'calendar.cannotConfigure': 'Провайдер не поддерживает настройку: {id}',

  // --- provider errors: google ---
  'google.enterCreds': 'Введите и Client ID, и Client secret.',
  'google.notConfigured': 'Учётные данные Google OAuth не настроены (см. README).',
  'google.tokenExchangeFailed': 'Не удалось обменять код на токен ({status})',
  'google.eventsFetchFailed': 'Не удалось получить события ({status})',
  'google.loopbackFailed': 'Не удалось открыть локальный порт для обратного вызова',
  'google.signInTimeout': 'Время ожидания входа истекло',
  'google.oauthPage.title': '🦆 Quakpit подключён!',
  'google.oauthPage.subtitle': 'Можно закрыть эту вкладку и вернуться в приложение.',
  'google.noAuthCode': 'Google не вернул код авторизации',
  'google.cannotRefresh': 'Не удалось обновить токен: нет подключения',
  'google.tokenRefreshFailed': 'Не удалось обновить токен ({status})',
  'google.noAccessToken': 'Токен доступа недоступен',

  // --- provider errors: icloud ---
  'icloud.notConnected': 'iCloud не подключён',
  'icloud.wrongCreds': 'Неверный Apple ID или пароль приложения.',
  'icloud.davError': 'Ошибка CalDAV iCloud ({status})',
  'icloud.noAccount': 'Не удалось найти вашу учётную запись iCloud.',
  'icloud.noCalendars': 'Не удалось найти ваши календари iCloud.',
  'icloud.enterCreds': 'Введите Apple ID и пароль приложения.',
  'icloud.fallbackCalendar': 'Календарь',

  // --- provider errors: ical ---
  'ical.invalidLink': 'Введите корректную ссылку на календарь (https или webcal).',
  'ical.fetchFailed': 'Не удалось загрузить календарь ({status}).',
  'ical.notIcal': 'По этой ссылке не iCal-календарь (.ics).',
  'ical.fallbackName': 'Календарь',

  // --- provider errors: exchange / ews ---
  'exchange.timeout': 'Сервер Exchange не ответил за отведённое время.',
  'exchange.unreachable': 'Не удалось связаться с сервером Exchange (сеть, VPN или недоверенный сертификат).',
  'exchange.status401': 'Сервер отклонил вход. Проверьте имя пользователя и пароль.',
  'exchange.status403': 'Доступ запрещён — возможно, администратор отключил EWS для вашей учётной записи.',
  'exchange.status404': 'По этому адресу EWS не найден. Уточните адрес сервера у IT.',
  'exchange.generic': 'Ошибка Exchange ({status}).',
  'exchange.noAuthMethod': 'Сервер не предложил поддерживаемый способ входа (Basic или NTLM).',
  'exchange.wrongCreds': 'Неверное имя пользователя, пароль или домен.',
  'exchange.enterAll': 'Введите адрес сервера, имя пользователя и пароль.',
  'exchange.connectFailed':
    'Не удалось подключиться: проверьте адрес сервера, имя пользователя и пароль. Если администратор отключил EWS, Quakpit не сможет читать этот календарь.',
  'ews.enterAddress': 'Введите адрес сервера Exchange.',
  'ews.badAddress': 'Это не похоже на адрес сервера.',
  'ews.useHttps': 'Используйте адрес https:// — пароль отправляется на этот сервер.',

  // --- updater ---
  'updater.title': 'Доступно обновление',
  'updater.ready': 'Quakpit {version} готов 🦆',
  'updater.restartNow': 'Перезапустить сейчас',
  'updater.later': 'Позже',
  'updater.detail.required': 'Загружено обязательное обновление. Quakpit перезапустится, чтобы установить его.',
  'updater.detail.optional':
    'Загружена новая версия. Перезапустите Quakpit для обновления — или оно установится при следующем закрытии приложения.',

  // --- dialogs ---
  'dialog.chooseImage': 'Выберите изображение самолёта',
  'dialog.images': 'Изображения'
}
