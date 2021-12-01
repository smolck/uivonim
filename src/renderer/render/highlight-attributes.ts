import { asColor, MapSet } from '../../common/utils'
import { pub } from '../dispatch'
import { EventEmitter } from 'events'
import { Invokables } from '../../common/ipc'

const ee = new EventEmitter()

interface Attrs {
  foreground?: number
  background?: number
  special?: number
  reverse?: string
  italic?: string
  bold?: string
  underline?: boolean
  undercurl?: boolean
  cterm_fg?: number
  cterm_bg?: number
}

interface Color {
  foreground?: string
  background?: string
  reverse?: boolean
}

interface HighlightGroup {
  foreground?: string
  background?: string
  special?: string
  underline: boolean
  reverse: boolean
}

interface HighlightInfoEvent {
  kind: 'ui' | 'syntax' | 'terminal'
  ui_name: string
  hi_name: string
  id: number
}

interface HighlightInfo {
  kind: 'ui' | 'syntax' | 'terminal'
  name: string
  builtinName: string
  id: number
  hlid: number
}

interface DefaultColors {
  background: string
  foreground: string
  special: string
}

const defaultAppColors = {
  background: '#2d2d2d',
  foreground: '#dddddd',
  special: '#a966ad',
}

const defaultColorsMap = new Map<number, DefaultColors>()
const getCurrentDefaultColors = () =>
  defaultColorsMap.get(0) || defaultAppColors

export const colors: DefaultColors = new Proxy(Object.create(null), {
  get: (_: any, key: string) => Reflect.get(getCurrentDefaultColors(), key),
})

// because we skip allocating 1-char strings in msgpack decode. so if we have a 1-char
// string it might be a code point number - need to turn it back into a string. see
// msgpack-decoder for more info on how this works.
const sillyString = (s: any): string =>
  typeof s === 'number' ? String.fromCodePoint(s) : s

const highlightInfo = MapSet<number, string, HighlightInfo>()
const canvas = document.createElement('canvas')
const ui = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
const highlights = new Map<number, HighlightGroup>()

export const setDefaultColors = (fg: number, bg: number, sp: number) => {
  const defaultColors = defaultColorsMap.get(0) || ({} as DefaultColors)

  const nextFG = fg >= 0 ? asColor(fg) : defaultColors.foreground
  const nextBG = bg >= 0 ? asColor(bg) : defaultColors.background
  const nextSP = sp >= 0 ? asColor(sp) : defaultColors.special

  const foreground = nextFG || defaultAppColors.foreground
  const background = nextBG || defaultAppColors.background
  const special = nextSP || defaultAppColors.special

  const same =
    defaultColors.foreground === foreground &&
    defaultColors.background === background &&
    defaultColors.special === special

  if (same) return false

  Object.assign(defaultColors, {
    foreground,
    background,
    special: special || defaultAppColors.special,
  })

  defaultColorsMap.set(0, defaultColors)

  pub('colors-changed', {
    fg: defaultColors.foreground,
    bg: defaultColors.background,
  })

  // hlid 0 -> default highlight group
  highlights.set(0, {
    foreground,
    background,
    special,
    underline: false,
    reverse: false,
  })

  return true
}

export const addHighlight = (
  id: number,
  attr: Attrs,
  infos: HighlightInfoEvent[]
) => {
  const foreground = attr.reverse
    ? asColor(attr.background)
    : asColor(attr.foreground)

  const background = attr.reverse
    ? asColor(attr.foreground)
    : asColor(attr.background)

  highlights.set(id, {
    foreground,
    background,
    special: asColor(attr.special),
    underline: !!(attr.underline || attr.undercurl),
    reverse: !!attr.reverse,
  })

  infos.forEach((info) => {
    const name = sillyString(info.hi_name)
    const builtinName = sillyString(info.ui_name)

    highlightInfo.set(0, sillyString(info.hi_name), {
      name,
      builtinName,
      hlid: id,
      id: info.id,
      kind: info.kind,
    })
  })

  ee.emit('highlight-info.added')
}

// TODO(smolck): Is this name misleading?
export const getColorByName = async (name: string): Promise<Color> => {
  const { foreground, background, reverse } = await window.api.invoke(
    Invokables.getHighlightByName,
    name,
    true
  )
  return {
    foreground: asColor(foreground),
    background: asColor(background),
    reverse,
  }
}

export const getColorById = (id: number): Color => {
  const hlgrp = highlights.get(id) || ({} as HighlightGroup)
  return {
    foreground: hlgrp.foreground,
    background: hlgrp.background,
  }
}

export const highlightLookup = (name: string): HighlightInfo[] => {
  const info = highlightInfo.get(0, name)
  if (!info)
    return console.error('highlight info does not exist for:', name), []
  return [...info]
}

export const generateColorLookupAtlas = () => {
  // hlid are 0 indexed, but width starts at 1
  const max = Math.max(...highlights.keys())
  const texelSize = 2
  canvas.width = (max + 1) * texelSize
  canvas.height = 3 * texelSize

  const defaultColors = getCurrentDefaultColors()
  ui.imageSmoothingEnabled = false

  highlights.forEach((hlgrp, id) => {
    const defbg = hlgrp.reverse
      ? defaultColors.foreground
      : defaultColors.background
    ui.fillStyle = hlgrp.background || defbg
    ui.fillRect(id * texelSize, 0, texelSize, texelSize)

    const deffg = hlgrp.reverse
      ? defaultColors.background
      : defaultColors.foreground
    ui.fillStyle = hlgrp.foreground || deffg
    ui.fillRect(id * texelSize, 1 * texelSize, texelSize, texelSize)

    if (!hlgrp.underline) return

    const color = hlgrp.special || defaultColors.special
    ui.fillStyle = color
    ui.fillRect(id * texelSize, 2 * texelSize, texelSize, texelSize)
  })

  return canvas
}

export const getColorAtlas = () => canvas
