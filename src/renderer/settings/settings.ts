import { THEMES, themeById } from '../themes'
import { HEADS, PLANE_COLORS, headById } from '../fliers'
import { FONTS, fontById } from '../fonts'
import { SOUNDS, playSound } from '../sounds'
import { planeUrl, planeBaseUrl, headUrl, headThumbUrl, BLADE_URL } from '../flier-assets'
import logoUrl from '../logo.png'

const q = window.quakpit
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

// ---- Tabs ----------------------------------------------------------------
const navItems = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-item'))
const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'))
function showTab(id: string): void {
  navItems.forEach((n) => n.classList.toggle('active', n.dataset.tab === id))
  panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === id))
}
navItems.forEach((n) => n.addEventListener('click', () => showTab(n.dataset.tab as string)))

// Mini category nav inside Appearance (Flier / Banner / Typo)
const subItems = Array.from(document.querySelectorAll<HTMLButtonElement>('.subnav-item'))
const subPanels = Array.from(document.querySelectorAll<HTMLElement>('.subpanel'))
function showSub(id: string): void {
  subItems.forEach((n) => n.classList.toggle('active', n.dataset.sub === id))
  subPanels.forEach((p) => p.classList.toggle('active', p.dataset.sub === id))
}
subItems.forEach((n) => n.addEventListener('click', () => showSub(n.dataset.sub as string)))

// ---- Elements ------------------------------------------------------------
const template = $<HTMLInputElement>('template')
const displaySel = $<HTMLSelectElement>('display')
const sound = $<HTMLInputElement>('sound')
const login = $<HTMLInputElement>('login')
const stay = $<HTMLInputElement>('stay')
const flyAtStart = $<HTMLInputElement>('flyatstart')

// Single-select "card" groups (Lead time, Speed). Returns a helper to set the
// current value.
function setupChoices(id: string, onPick: (value: string) => void): {
  set: (v: string) => void
} {
  const group = $(id)
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('.choice'))
  const set = (v: string): void =>
    buttons.forEach((b) => b.classList.toggle('selected', b.dataset.value === v))
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      set(b.dataset.value as string)
      onPick(b.dataset.value as string)
    })
  )
  return { set }
}
const leadChoices = setupChoices('lead', (v) => void q.setPrefs({ leadMinutes: Number(v) }))
const speedChoices = setupChoices('speed', (v) => void q.setPrefs({ speed: v as Prefs['speed'] }))

const headsEl = $('heads')
const colorsEl = $('colors')
const themesEl = $('themes')
const fontsEl = $('fonts')
const soundsEl = $('sounds')

// Appearance live preview (plane flies in place, no sound)
const pvBanner = document.querySelector('#appearance-preview .banner') as HTMLDivElement
const pvPlane = document.querySelector('#appearance-preview .plane') as HTMLImageElement
const pvHead = document.querySelector('#appearance-preview .head') as HTMLImageElement
const pvProp = document.querySelector('#appearance-preview .prop') as HTMLImageElement
pvProp.src = BLADE_URL

// Calendar — picker + wizards
const calPicker = $('cal-picker')
const wizIcal = $('wiz-ical')
const wizIcloud = $('wiz-icloud')
const wizExchange = $('wiz-exchange')
const pickIcalStatus = $('pick-ical-status')
const pickIcloudStatus = $('pick-icloud-status')
const pickExchangeStatus = $('pick-exchange-status')
const upcomingList = $<HTMLUListElement>('upcoming')
const upcomingRefresh = $<HTMLButtonElement>('upcoming-refresh')
// iCal-link wizard
const icalUrl = $<HTMLInputElement>('ical-url')
const icalName = $<HTMLInputElement>('ical-name')
const icalAddBtn = $<HTMLButtonElement>('ical-add')
const icalError = $('ical-error')
const icalFeedsEl = $<HTMLUListElement>('ical-feeds')
// iCloud wizard
const iStepForm = $('i-step-form')
const iStepConnected = $('i-step-connected')
const iUser = $<HTMLInputElement>('i-user')
const iPass = $<HTMLInputElement>('i-pass')
const iConnect = $<HTMLButtonElement>('i-connect')
const iDisconnect = $<HTMLButtonElement>('i-disconnect')
const iDetail = $('i-detail')
const iError = $('i-error')
// Exchange wizard
const xStepForm = $('x-step-form')
const xStepConnected = $('x-step-connected')
const xServer = $<HTMLInputElement>('x-server')
const xUser = $<HTMLInputElement>('x-user')
const xPass = $<HTMLInputElement>('x-pass')
const xConnect = $<HTMLButtonElement>('x-connect')
const xDisconnect = $<HTMLButtonElement>('x-disconnect')
const xDetail = $('x-detail')
const xError = $('x-error')

const testBtn = $<HTMLButtonElement>('test-btn')
$<HTMLImageElement>('brand-logo').src = logoUrl

// ---- State ---------------------------------------------------------------
let previewCtx: AudioContext | null = null
let prefs: Prefs = {
  leadMinutes: 5,
  messageTemplate: '{title} in {minutes} minutes',
  soundEnabled: true,
  staySignedIn: true,
  launchAtLogin: false,
  targetDisplay: 'cursor',
  theme: 'classic',
  flier: 'duck-plane',
  font: 'system',
  speed: 'normal',
  flyAtStart: false,
  soundPack: 'quack',
  flierHead: 'duck',
  flierColor: 'red',
  customFlierName: ''
}

// ---- General -------------------------------------------------------------
function fillPrefs(p: Prefs): void {
  prefs = p
  leadChoices.set(String(p.leadMinutes))
  template.value = p.messageTemplate
  displaySel.value = p.targetDisplay
  sound.checked = p.soundEnabled
  login.checked = p.launchAtLogin
  stay.checked = p.staySignedIn
  speedChoices.set(p.speed)
  flyAtStart.checked = p.flyAtStart
  renderHeads()
  renderColors()
  renderThemes()
  renderFonts()
  renderSounds()
  renderPreview()
}
template.addEventListener('change', () => void q.setPrefs({ messageTemplate: template.value }))
displaySel.addEventListener('change', () =>
  void q.setPrefs({ targetDisplay: displaySel.value as Prefs['targetDisplay'] })
)
sound.addEventListener('change', () => void q.setPrefs({ soundEnabled: sound.checked }))
login.addEventListener('change', () => void q.setPrefs({ launchAtLogin: login.checked }))
stay.addEventListener('change', () => void q.setPrefs({ staySignedIn: stay.checked }))
flyAtStart.addEventListener('change', () => void q.setPrefs({ flyAtStart: flyAtStart.checked }))

// Banner-message token tags: insert {title} / {minutes} at the cursor.
Array.from(document.querySelectorAll<HTMLButtonElement>('.tag-btn')).forEach((b) =>
  b.addEventListener('click', () => {
    const token = b.dataset.token ?? ''
    const start = template.selectionStart ?? template.value.length
    const end = template.selectionEnd ?? template.value.length
    template.value = template.value.slice(0, start) + token + template.value.slice(end)
    const pos = start + token.length
    template.focus()
    template.setSelectionRange(pos, pos)
    void q.setPrefs({ messageTemplate: template.value })
  })
)

// ---- Appearance: Flier = character head + plane colour -------------------
// Each tile is a complete mini-plane (plane colour + head) so it's always clear.
// A flier tile shows a single image: a head (tile = just the head, bigger) or a
// plane colour (tile = just the plane, with its static blade).
function flierTile(opts: {
  img: string
  fillClass: string
  name: string
  selected: boolean
  onClick: () => void
}): HTMLButtonElement {
  const tile = document.createElement('button')
  tile.className = 'swatch flier-swatch' + (opts.selected ? ' selected' : '')
  const fill = document.createElement('span')
  fill.className = 'swatch-fill ' + opts.fillClass
  const img = document.createElement('img')
  img.src = opts.img
  fill.append(img)
  const name = document.createElement('span')
  name.className = 'swatch-name'
  name.textContent = opts.name
  tile.append(fill, name)
  tile.addEventListener('click', opts.onClick)
  return tile
}

function renderHeads(): void {
  headsEl.innerHTML = ''
  for (const h of HEADS) {
    headsEl.append(
      flierTile({
        img: headThumbUrl(h.id), // just the head, cropped → shows bigger
        fillClass: 'head-sample',
        name: h.name,
        selected: prefs.flierHead === h.id,
        onClick: () => pickHead(h.id)
      })
    )
  }
}

function renderColors(): void {
  colorsEl.innerHTML = ''
  for (const c of PLANE_COLORS) {
    colorsEl.append(
      flierTile({
        img: planeUrl(c.id), // just the plane (static blade)
        fillClass: 'plane-sample',
        name: c.name,
        selected: prefs.flierColor === c.id,
        onClick: () => pickColor(c.id)
      })
    )
  }
}

function pickHead(id: string): void {
  const h = headById(id)
  // Picking an animal also switches the flight sound to that animal's voice.
  prefs.flierHead = id
  prefs.soundPack = h.sound
  void q.setPrefs({ flierHead: id, soundPack: h.sound })
  renderHeads()
  renderColors()
  renderSounds()
  renderPreview()
  previewSound(h.sound) // hear the animal
}

function pickColor(id: string): void {
  prefs.flierColor = id
  void q.setPrefs({ flierColor: id })
  renderHeads()
  renderColors()
  renderPreview()
}

// Static speaker icon for the sound tiles (no user data — safe as innerHTML).
const SOUND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a4 4 0 0 1 0 7"/><path d="M18.5 6a8 8 0 0 1 0 12"/></svg>'

function renderSounds(): void {
  soundsEl.innerHTML = ''
  for (const s of SOUNDS) {
    const tile = document.createElement('button')
    tile.className = 'swatch sound-swatch' + (prefs.soundPack === s.id ? ' selected' : '')
    const fill = document.createElement('span')
    fill.className = 'swatch-fill sound-sample'
    fill.innerHTML = SOUND_ICON
    const name = document.createElement('span')
    name.className = 'swatch-name'
    name.textContent = s.name
    tile.append(fill, name)
    tile.addEventListener('click', () => {
      prefs.soundPack = s.id
      void q.setPrefs({ soundPack: s.id })
      renderSounds()
      previewSound(s.id)
    })
    soundsEl.append(tile)
  }
}

/** Plays a chosen sound so the user can hear it before committing. */
function previewSound(id: string): void {
  try {
    if (!previewCtx) previewCtx = new AudioContext()
    if (previewCtx.state === 'suspended') void previewCtx.resume()
    playSound(previewCtx, id)
  } catch {
    /* preview is best-effort */
  }
}

function renderThemes(): void {
  themesEl.innerHTML = ''
  for (const t of THEMES) {
    const tile = document.createElement('button')
    tile.className = 'swatch' + (prefs.theme === t.id ? ' selected' : '')
    // The fill shows the actual banner stripes so you really see the colours.
    const fill = document.createElement('span')
    fill.className = 'swatch-fill'
    fill.style.background = `repeating-linear-gradient(-8deg, ${t.a} 0 11px, ${t.b} 11px 22px)`
    const name = document.createElement('span')
    name.className = 'swatch-name'
    name.textContent = t.name
    tile.append(fill, name)
    tile.addEventListener('click', () => {
      prefs.theme = t.id
      void q.setPrefs({ theme: t.id })
      renderThemes()
      renderPreview()
    })
    themesEl.append(tile)
  }
}

/** Updates the live Appearance preview to match the current selection. */
function renderPreview(): void {
  const theme = themeById(prefs.theme)
  pvBanner.style.setProperty('--stripe-a', theme.a)
  pvBanner.style.setProperty('--stripe-b', theme.b)
  pvBanner.style.setProperty('--banner-ink', theme.text)
  pvBanner.style.setProperty('--banner-font', fontById(prefs.font).stack)
  pvPlane.src = planeBaseUrl(prefs.flierColor)
  pvHead.src = headUrl(prefs.flierHead)
}

function renderFonts(): void {
  fontsEl.innerHTML = ''
  for (const f of FONTS) {
    const tile = document.createElement('button')
    tile.className = 'swatch font-swatch' + (prefs.font === f.id ? ' selected' : '')
    // Same tile size as the banner swatches, previewing the font with "Hello".
    const fill = document.createElement('span')
    fill.className = 'swatch-fill font-sample'
    fill.style.fontFamily = f.stack
    fill.textContent = 'Hello'
    const name = document.createElement('span')
    name.className = 'swatch-name'
    name.textContent = f.name
    tile.append(fill, name)
    tile.addEventListener('click', () => {
      prefs.font = f.id
      void q.setPrefs({ font: f.id })
      renderFonts()
      renderPreview()
    })
    fontsEl.append(tile)
  }
}

// ---- Calendar (picker + wizards) -----------------------------------------
const hide = (el: HTMLElement): void => el.classList.add('hidden')
const show = (el: HTMLElement): void => el.classList.remove('hidden')

function renderCalendar(statuses: ProviderStatus[]): void {
  const ic = statuses.find((s) => s.id === 'ical')
  const i = statuses.find((s) => s.id === 'icloud')
  const x = statuses.find((s) => s.id === 'exchange')

  pickIcalStatus.textContent = ic?.connected ? (ic.detail ?? 'Connected') : 'Not connected'
  pickIcalStatus.classList.toggle('connected', !!ic?.connected)
  pickIcloudStatus.textContent = i?.connected
    ? i.detail
      ? `Connected · ${i.detail}`
      : 'Connected'
    : 'Not connected'
  pickIcloudStatus.classList.toggle('connected', !!i?.connected)
  pickExchangeStatus.textContent = x?.connected
    ? x.detail
      ? `Connected · ${x.detail}`
      : 'Connected'
    : 'Not connected'
  pickExchangeStatus.classList.toggle('connected', !!x?.connected)

  // iCloud wizard: form → connected
  if (i?.connected) {
    iDetail.textContent = i.detail ?? ''
    hide(iStepForm)
    show(iStepConnected)
  } else {
    show(iStepForm)
    hide(iStepConnected)
  }

  // Exchange wizard: form → connected
  if (x?.connected) {
    xDetail.textContent = x.detail ?? ''
    hide(xStepForm)
    show(xStepConnected)
  } else {
    show(xStepForm)
    hide(xStepConnected)
  }
}

function renderUpcoming(events: UpcomingEvent[], connected: boolean): void {
  upcomingList.innerHTML = ''
  if (events.length === 0) {
    const li = document.createElement('li')
    li.className = 'up-empty'
    li.textContent = connected
      ? 'No meetings in the next couple of hours.'
      : 'Connect a calendar to see your meetings.'
    upcomingList.append(li)
    return
  }
  for (const ev of events.slice(0, 6)) {
    const li = document.createElement('li')
    const dot = document.createElement('span')
    dot.className = 'up-dot'
    const title = document.createElement('span')
    title.className = 'up-title'
    title.textContent = ev.title
    const when = document.createElement('span')
    when.className = 'up-time'
    when.textContent = new Date(ev.start).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
    li.append(dot, title, when)
    upcomingList.append(li)
  }
}

function renderFeeds(feeds: Feed[]): void {
  icalFeedsEl.innerHTML = ''
  if (feeds.length === 0) {
    const li = document.createElement('li')
    li.className = 'muted'
    li.textContent = 'None yet.'
    icalFeedsEl.append(li)
    return
  }
  for (const f of feeds) {
    const li = document.createElement('li')
    const name = document.createElement('span')
    name.textContent = f.name
    const rm = document.createElement('button')
    rm.className = 'btn btn-outline btn-sm'
    rm.textContent = 'Remove'
    rm.addEventListener('click', async () => {
      renderFeeds(await q.icalRemove(f.id))
      await refreshCalendar()
    })
    li.append(name, rm)
    icalFeedsEl.append(li)
  }
}

async function refreshCalendar(): Promise<void> {
  const statuses = await q.calStatus()
  renderCalendar(statuses)
  const connected = statuses.some((s) => s.connected)
  renderUpcoming(connected ? await q.upcoming() : [], connected)
}

upcomingRefresh.addEventListener('click', async () => {
  upcomingRefresh.disabled = true
  upcomingRefresh.classList.add('spinning')
  try {
    await refreshCalendar()
  } finally {
    upcomingRefresh.disabled = false
    upcomingRefresh.classList.remove('spinning')
  }
})

function showPicker(): void {
  show(calPicker)
  hide(wizIcal)
  hide(wizIcloud)
  hide(wizExchange)
}
async function openWizard(provider: string): Promise<void> {
  hide(calPicker)
  hide(icalError)
  hide(iError)
  hide(xError)
  wizIcal.classList.toggle('hidden', provider !== 'ical')
  wizIcloud.classList.toggle('hidden', provider !== 'icloud')
  wizExchange.classList.toggle('hidden', provider !== 'exchange')
  if (provider === 'ical') renderFeeds(await q.icalList())
}
document.querySelectorAll<HTMLElement>('.provider-btn').forEach((b) =>
  b.addEventListener('click', () => {
    void openWizard(b.dataset.go ?? '')
  })
)
document.querySelectorAll<HTMLElement>('[data-back]').forEach((b) =>
  b.addEventListener('click', showPicker)
)

// iCal-link wizard
icalAddBtn.addEventListener('click', async () => {
  hide(icalError)
  icalAddBtn.disabled = true
  icalAddBtn.textContent = 'Adding…'
  try {
    renderFeeds(await q.icalAdd(icalUrl.value, icalName.value))
    icalUrl.value = ''
    icalName.value = ''
    await refreshCalendar()
  } catch (e) {
    icalError.textContent = (e as Error).message
    show(icalError)
  } finally {
    icalAddBtn.disabled = false
    icalAddBtn.textContent = 'Add calendar'
  }
})

// iCloud wizard
iConnect.addEventListener('click', async () => {
  hide(iError)
  iConnect.disabled = true
  iConnect.textContent = 'Connecting…'
  try {
    renderCalendar(await q.calConnect('icloud', { username: iUser.value, password: iPass.value }))
    iPass.value = ''
    renderUpcoming(await q.upcoming(), true)
  } catch (e) {
    iError.textContent = (e as Error).message
    show(iError)
  } finally {
    iConnect.disabled = false
    iConnect.textContent = 'Connect'
  }
})
iDisconnect.addEventListener('click', async () => {
  renderCalendar(await q.calDisconnect('icloud'))
  renderUpcoming([], false)
})

// Exchange wizard
xConnect.addEventListener('click', async () => {
  hide(xError)
  xConnect.disabled = true
  xConnect.textContent = 'Connecting…'
  try {
    renderCalendar(
      await q.calConnect('exchange', {
        serverUrl: xServer.value,
        username: xUser.value,
        password: xPass.value
      })
    )
    xPass.value = ''
    renderUpcoming(await q.upcoming(), true)
  } catch (e) {
    xError.textContent = (e as Error).message
    show(xError)
  } finally {
    xConnect.disabled = false
    xConnect.textContent = 'Connect'
  }
})
xDisconnect.addEventListener('click', async () => {
  renderCalendar(await q.calDisconnect('exchange'))
  renderUpcoming([], false)
})

document.getElementById('made-by')?.addEventListener('click', (e) => {
  e.preventDefault()
  void q.openExternal('https://ooble.studio')
})

testBtn.addEventListener('click', () => void q.testFlight())

// ---- Init ----------------------------------------------------------------
void (async () => {
  fillPrefs(await q.getPrefs())
  await refreshCalendar()
})()
