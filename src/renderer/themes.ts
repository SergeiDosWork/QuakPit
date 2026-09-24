// Banner colour themes, shared by the overlay (rendering) and settings (picker).
export type Theme = {
  id: string
  name: string
  a: string // stripe colour A
  b: string // stripe colour B
  text: string // banner text colour
}

export const THEMES: Theme[] = [
  { id: 'classic', name: 'Classic', a: '#ffffff', b: '#ffe24d', text: '#1a1a1a' }
]

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
