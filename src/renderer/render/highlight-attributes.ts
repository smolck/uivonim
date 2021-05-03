import { asColor, MapMap, MapSet } from '../../common/utils'
import { pub } from '../dispatch'
import { EventEmitter } from 'events'
import { Invokables } from '../../common/ipc'

const ee = new EventEmitter()

export interface Attrs {
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
  // TODO(smolck): The colors map etc. stuff probably isn't necessary anymore;
  // just using zero here where before the worker instance id was used, which
  // isn't really a thing anymore so . . .
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
const highlights = MapMap<number, number, HighlightGroup>()

export const setDefaultColors = (fg: number, bg: number, sp: number) => {
  const defaultColors =
    defaultColorsMap.get(0) || ({} as DefaultColors)

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
  highlights.set(0, 0, {
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

  highlights.set(0, id, {
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

export const getColorByName = async (name: string): Promise<Color> => {
  const { foreground, background } = await window.api.invoke(Invokables.getColorByName, name)
  return {
    foreground: asColor(foreground),
    background: asColor(background),
  }
}

export const getColorById = (id: number): Color => {
  const hlgrp =
    highlights.get(0, id) || ({} as HighlightGroup)
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
export const getHighlight = (id: number) =>
  highlights.get(0, id)

export const generateColorLookupAtlas = () => {
  // hlid are 0 indexed, but width starts at 1
  const max = Math.max(...highlights.keys(0))
  const texelSize = 2
  canvas.width = (max + 1) * texelSize
  canvas.height = 3 * texelSize

  const defaultColors = getCurrentDefaultColors()
  ui.imageSmoothingEnabled = false

  highlights.forEach(0, (hlgrp, id) => {
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
