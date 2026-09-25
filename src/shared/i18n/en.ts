import type { Dict } from './core'

/**
 * English source strings. en is the source of truth: every key here must also
 * exist in ru.ts (enforced by catalogs.test.ts). HTML-bearing values are used
 * ONLY via data-i18n-html on trusted, static catalog markup (<b>, <a>).
 */
export const en: Dict = {
  // --- tray ---
  'tray.tooltip': 'Quakpit',
  'tray.open': 'Open Quakpit',
  'tray.testFlight': 'Send a test flight  (⌘⇧D)',
  'tray.quit': 'Quit Quakpit',

  // --- settings chrome ---
  'settings.windowTitle': 'Quakpit — Settings',
  'settings.tab.general': 'General',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.calendar': 'Calendar',
  'settings.testFlight': 'Send a test flight',
  'settings.presentedBy': 'Presented by',

  // --- general tab ---
  'settings.general.subtitle': 'When and how the duck flies by.',
  'settings.reminders': 'Reminders',
  'settings.lead.label': 'Lead time',
  'settings.lead.hint': 'Fly this long before a meeting',
  'settings.lead.5': '5 min',
  'settings.lead.15': '15 min',
  'settings.lead.30': '30 min',
  'settings.flyAtStart.label': 'Fly again at meeting time',
  'settings.flyAtStart.hint': 'A second fly-by right when it starts',
  'settings.banner.label': 'Banner message',
  'settings.banner.hint': 'Tap a tag to insert it',
  'settings.flight': 'Flight',
  'settings.speed.label': 'Speed',
  'settings.speed.hint': 'How fast the plane crosses the screen',
  'settings.display.label': 'Show on',
  'settings.display.hint': 'Which screen the plane uses',
  'settings.display.cursor': 'Screen with my cursor',
  'settings.display.primary': 'My main screen',
  'settings.launch.label': 'Launch at login',
  'settings.launch.hint': 'Start Quakpit when you sign in',
  'settings.hideDock.label': 'Hide Dock icon',
  'settings.hideDock.hint': 'Menu-bar-only app — reopen Quakpit from the tray icon',
  'settings.stay.label': 'Stay signed in',
  'settings.stay.hint': 'Store the calendar token (encrypted)',
  'settings.language.label': 'Language',
  'settings.language.hint': 'Applies immediately, no restart needed',
  'settings.language.auto': 'Auto — system language',

  // --- appearance tab ---
  'settings.appearance.subtitle': 'Make Quakpit yours.',
  'settings.preview.banner': 'Meeting in 5 minutes',
  'settings.sub.flier': 'Flier',
  'settings.sub.banner': 'Banner',
  'settings.sub.typo': 'Typo',
  'settings.sub.sound': 'Sound',
  'settings.flier.hint': 'Pick a head, then a plane colour.',
  'settings.flier.head': 'Head',
  'settings.flier.color': 'Plane colour',
  'settings.bannerTheme': 'Banner theme',
  'settings.bannerTheme.hint': 'Stripe colours of the towed banner.',
  'settings.typography': 'Typography',
  'settings.typography.hint': 'Banner font.',
  'settings.engine.label': 'Engine sound',
  'settings.engine.hint': 'Engine + sound while it flies',
  'settings.flightSound.label': 'Flight sound',
  'settings.flightSound.hint': 'Follows your animal — tap to preview',
  'option.fontPreview': 'Hello',

  // --- calendar tab ---
  'settings.calendar.subtitle': 'Read on this device only — never sent anywhere.',
  'settings.provider.byLink': 'Add by link',
  'settings.badge.easiest': 'easiest',
  'settings.state.connected': 'Connected',
  'settings.state.connectedDetail': 'Connected · {detail}',
  'settings.state.connectedOk': '✅ Connected',
  'settings.state.notConnected': 'Not connected',
  'settings.nextUp': 'Next up',
  'settings.nextUp.refreshTitle': 'Re-check your calendars now',
  'settings.upcoming.empty': 'No meetings in the next couple of hours.',
  'settings.upcoming.connect': 'Connect a calendar to see your meetings.',
  'settings.privacy': '🔒 Everything stays on this device. Quakpit has no server.',

  // --- wizards (shared actions) ---
  'settings.back': '‹ Back',
  'settings.action.connect': 'Connect',
  'settings.action.connecting': 'Connecting…',
  'settings.action.disconnect': 'Disconnect',
  'settings.action.remove': 'Remove',

  // --- iCal-link wizard ---
  'settings.ical.title': 'Add a calendar by link',
  'settings.ical.cardTitle': 'Paste a calendar link (iCal / .ics)',
  'settings.ical.step1':
    'Google Calendar (web): your calendar → <b>Settings and sharing</b> → <b>Integrate calendar</b> → copy <b>Secret address in iCal format</b>.',
  'settings.ical.step2': 'Outlook / Fastmail / others: look for <b>Publish</b> or an <b>iCal/ICS</b> link.',
  'settings.ical.step3': 'Paste it below — add as many calendars as you like.',
  'settings.ical.linkLabel': 'Calendar link',
  'settings.ical.urlPlaceholder': 'https://…/basic.ics  (or webcal://…)',
  'settings.ical.nameLabel': 'Name (optional)',
  'settings.ical.namePlaceholder': 'Work',
  'settings.ical.add': 'Add calendar',
  'settings.ical.adding': 'Adding…',
  'settings.ical.feedsTitle': 'Your calendar links',
  'settings.ical.none': 'None yet.',

  // --- iCloud wizard ---
  'settings.icloud.title': 'Connect Apple iCloud',
  'settings.icloud.cardTitle': 'Connect with an app-specific password',
  'settings.icloud.step1':
    'Open <a href="https://appleid.apple.com" target="_blank" rel="noopener">appleid.apple.com</a> → Sign-In &amp; Security → <b>App-Specific Passwords</b> → generate one.',
  'settings.icloud.step2': 'Enter your Apple ID and that password below.',
  'settings.icloud.appleId': 'Apple ID',
  'settings.icloud.appPassword': 'App-specific password',

  // --- Exchange wizard ---
  'settings.exchange.title': 'Connect Microsoft Exchange',
  'settings.exchange.cardTitle': 'Connect to your company Exchange server',
  'settings.exchange.step1': 'Ask IT for the EWS address — usually <b>https://mail.company.com/EWS/Exchange.asmx</b>.',
  'settings.exchange.step2': 'Sign in with your Windows login, e.g. <b>CORP\\jane</b> or <b>jane@corp.com</b>.',
  'settings.exchange.step3': 'The server must be reachable — from the office network or VPN.',
  'settings.exchange.server': 'Server address',
  'settings.exchange.serverPlaceholder': 'mail.company.com',
  'settings.exchange.username': 'Username',
  'settings.exchange.userPlaceholder': 'CORP\\jane',
  'settings.exchange.password': 'Password',

  // --- Google wizard ---
  'settings.google.title': 'Connect Google Calendar',
  'settings.google.cardTitle': 'Connect with your own Google OAuth client',
  'settings.google.step1':
    'Open <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> → create a project → enable the <b>Google Calendar API</b>.',
  'settings.google.step2':
    'OAuth consent screen → <b>External</b> → add the scope <b>calendar.events.readonly</b> (in test mode, add yourself as a Test user).',
  'settings.google.step3': 'Credentials → Create credentials → <b>OAuth client ID</b> → <b>Desktop app</b> → paste the ID and the secret below.',
  'settings.google.clientId': 'Client ID',
  'settings.google.clientIdPlaceholder': '1234-abc.apps.googleusercontent.com',
  'settings.google.clientSecret': 'Client secret',
  'settings.google.hint':
    'Already set up oauth-credentials.json? Leave both fields empty and just connect.',

  // --- option display names (looked up as `option.<group>.<id>`) ---
  'option.head.duck': 'Duck',
  'option.color.red': 'Red',
  'option.theme.classic': 'Classic',
  'option.font.system': 'System',
  'option.font.rounded': 'Rounded',
  'option.font.serif': 'Serif',
  'option.font.mono': 'Mono',
  'option.font.condensed': 'Condensed',
  'option.sound.quack': 'Duck',

  // --- main → UI strings ---
  'demo.message': 'Call with Jack in 5 minutes',
  'scheduler.startingNow': '{title} starting now',
  'banner.default': '{title} in {minutes} minutes',
  'event.untitled': 'Untitled event',
  'calendar.google.name': 'Google Calendar',
  'calendar.ical.name': 'Calendar links',
  'calendar.icloud.name': 'iCloud',
  'calendar.exchange.name': 'Exchange',
  'calendar.unknownProvider': 'Unknown provider: {id}',
  'calendar.cannotConfigure': 'Cannot configure provider: {id}',

  // --- provider errors: google ---
  'google.enterCreds': 'Enter both the Client ID and the Client secret.',
  'google.notConfigured': 'Google OAuth credentials are not configured (see README).',
  'google.tokenExchangeFailed': 'Token exchange failed ({status})',
  'google.eventsFetchFailed': 'Events fetch failed ({status})',
  'google.loopbackFailed': 'Could not open a local callback port',
  'google.signInTimeout': 'Sign-in timed out',
  'google.oauthPage.title': '🦆 Quakpit is connected!',
  'google.oauthPage.subtitle': 'You can close this tab and return to the app.',
  'google.noAuthCode': 'No authorization code returned',
  'google.cannotRefresh': 'Cannot refresh: not connected',
  'google.tokenRefreshFailed': 'Token refresh failed ({status})',
  'google.noAccessToken': 'No access token available',

  // --- provider errors: icloud ---
  'icloud.notConnected': 'iCloud not connected',
  'icloud.wrongCreds': 'Wrong Apple ID or app-specific password.',
  'icloud.davError': 'iCloud CalDAV error ({status})',
  'icloud.redirect': 'The iCloud server pointed at an untrusted address. The request was stopped for your safety.',
  'icloud.noAccount': 'Could not find your iCloud account.',
  'icloud.noCalendars': 'Could not find your iCloud calendars.',
  'icloud.enterCreds': 'Enter your Apple ID and an app-specific password.',
  'icloud.fallbackCalendar': 'Calendar',

  // --- provider errors: ical ---
  'ical.invalidLink': 'Enter a valid calendar link (https or webcal).',
  'ical.fetchFailed': 'Could not fetch the calendar ({status}).',
  'ical.httpsOnly': 'Use an https:// link — plain http:// feeds are not accepted for safety.',
  'ical.notIcal': 'That link is not an iCal (.ics) calendar.',
  'ical.fallbackName': 'Calendar',

  // --- provider errors: exchange / ews ---
  'exchange.timeout': 'The Exchange server did not respond in time.',
  'exchange.unreachable': 'Cannot reach the Exchange server (network, VPN or untrusted certificate).',
  'exchange.redirect':
    'The Exchange server tried to redirect the login to another address. The request was stopped for your safety.',
  'exchange.status401': 'The server rejected the login. Check your username and password.',
  'exchange.status403': 'Access denied — EWS may be disabled for your account by your administrator.',
  'exchange.status404': 'EWS not found at this address. Check the server address with IT.',
  'exchange.generic': 'Exchange error ({status}).',
  'exchange.noAuthMethod': 'The server offered no supported login method (Basic or NTLM).',
  'exchange.wrongCreds': 'Wrong username, password or domain.',
  'exchange.enterAll': 'Enter the server address, your username and your password.',
  'exchange.details': 'Technical details',
  'exchange.detailsCopy': 'Copy',
  'exchange.detailsCopied': 'Copied',
  'ews.enterAddress': 'Enter your Exchange server address.',
  'ews.badAddress': 'That does not look like a server address.',
  'ews.useHttps': 'Use an https:// address — your password is sent to this server.',

  // --- dialogs ---
  'dialog.chooseImage': 'Choose a plane image',
  'dialog.images': 'Images'
}
