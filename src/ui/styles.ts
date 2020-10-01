import {
  setVar,
  paddingVH,
  paddingV,
  contrast,
  darken,
  brighten,
  cvar,
  hexToRGB,
} from '../ui/css'
import { colors as nvimColors } from '../render/highlight-attributes'
import { sub } from '../messaging/dispatch'
import { css } from '../ui/uikit'

// this will return a var like '244, 120, 042'
// then we can use this var in rgba color styles
// background: rgba(var(--background-40-alpha), 0.8);
const rgb = (hexColor: string) => {
  const [r, g, b] = hexToRGB(hexColor)
  return `${r}, ${g}, ${b}`
}

// TODO: investigate if css filters would be better suited for this
const refreshColors = ({ fg, bg }: { fg: string; bg: string }) => {
  setVar('background-b10', brighten(bg, 10))
  setVar('background-b5', brighten(bg, 5))
  setVar('background', bg)
  setVar('background-10', darken(bg, 10))
  setVar('background-15', darken(bg, 15))
  setVar('background-20', darken(bg, 20))
  setVar('background-30', darken(bg, 30))
  setVar('background-40', darken(bg, 40))
  setVar('background-45', darken(bg, 45))
  setVar('background-50', darken(bg, 50))

  setVar('background-alpha', rgb(bg))
  setVar('background-b20-alpha', rgb(brighten(bg, 20)))
  setVar('background-30-alpha', rgb(darken(bg, 30)))
  setVar('background-40-alpha', rgb(darken(bg, 40)))
  setVar('background-45-alpha', rgb(darken(bg, 45)))

  setVar('foreground-b60', brighten(fg, 60))
  setVar('foreground-b40', brighten(fg, 40))
  setVar('foreground-b20', brighten(fg, 20))
  setVar('foreground-b10', brighten(fg, 10))
  setVar('foreground', fg)
  setVar('foreground-10', contrast(fg, bg, 10))
  setVar('foreground-15', contrast(fg, bg, 15))
  setVar('foreground-20', contrast(fg, bg, 20))
  setVar('foreground-30', contrast(fg, bg, 30))
  setVar('foreground-40', contrast(fg, bg, 40))
  setVar('foreground-45', contrast(fg, bg, 45))
  setVar('foreground-50', contrast(fg, bg, 50))
  setVar('foreground-60', contrast(fg, bg, 60))
  setVar('foreground-70', contrast(fg, bg, 70))
  setVar('foreground-80', contrast(fg, bg, 80))
  setVar('foreground-90', contrast(fg, bg, 90))
  setVar('foreground-100', contrast(fg, bg, 100))
}

sub('colors-changed', refreshColors)

requestAnimationFrame(() =>
  refreshColors({
    fg: nvimColors.foreground,
    bg: nvimColors.background,
  })
)

setVar('error', '#ef2f2f')
setVar('warning', '#ffb100')
setVar('success', '#72a940')
setVar('system', '#28b0ff')
setVar('important', '#ffd800')

export const colors = {
  hint: '#c7c7c7',
  info: '#eee',
  error: '#ef2f2f',
  warning: '#ffb100',
  success: '#72a940',
  system: '#28b0ff',
  important: '#ffd800',
  progress: '#c7c7c7',
}

export const badgeStyle = {
  ...paddingV(4),
  borderRadius: '2px',
  background: cvar('background-30'),
}

export const docStyle = {
  ...paddingVH(8, 6),
  overflow: 'visible',
  whiteSpace: 'normal',
  fontSize: '0.9rem',
  color: cvar('foreground-40'),
  background: cvar('background-45'),
}

export const resetMarkdownHTMLStyle = css((id) => [
  `.${id} p {
    padding: 0;
    margin: 0;
  }`,

  `.${id} p:nth-child(n+2) {
    margin-top: 8px;
  }`,
])
