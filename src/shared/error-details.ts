// Rich errors travel through Electron's IPC as plain Error messages — custom
// properties (and anything else on the Error object) are dropped. So extra
// diagnostic context rides inside `message` after a marker: exchange.ts
// attaches a sanitized trace, the settings renderer splits it back out and
// shows it in a collapsible "technical details" block. The marker text is
// deliberately ASCII and unlikely to appear in a localized message.

export const DETAILS_MARKER = '@@details@@'

/** Appends a diagnostic trace to a user-facing message. Empty traces are a
 * no-op so ordinary errors keep exactly the text the catalogs define. */
export function attachDetails(message: string, lines: string[]): string {
  if (lines.length === 0) return message
  return `${message}\n${DETAILS_MARKER}\n${lines.join('\n')}`
}

/** Splits a message back into the human-facing part and the trace (or null). */
export function splitErrorDetails(message: string): { main: string; details: string | null } {
  const idx = message.indexOf(DETAILS_MARKER)
  if (idx === -1) return { main: message, details: null }
  const main = message.slice(0, idx).replace(/\n+$/, '')
  const details = message.slice(idx + DETAILS_MARKER.length).replace(/^\n+/, '') || null
  return { main, details }
}

/** Electron wraps IPC errors as "Error invoking remote method 'x': Error: …". */
export function stripIpcPrefix(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '')
}
