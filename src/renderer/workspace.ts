import { merge, throttle } from '../common/utils'
import robotoSizes from '../common/roboto-sizes'
import { EventEmitter } from 'events'
import { setVar } from './ui/css'
import { invoke, canvasKit } from './helpers'
import { Font as CkFont } from 'canvaskit-wasm'

const ck = canvasKit()
let ckFont: CkFont
export const getCkFont = () => {
  if (!ckFont) {
    throw new Error("yo we need this ckFont")
  }

  return ckFont
}

interface UpdateEditorFontParams {
  face?: string
  size?: number
  lineSpace?: number
}

export interface Cell {
  height: number
  width: number
  padding: number
}

export interface Font {
  face: string
  size: number
  lineSpace: number
}

export interface Pad {
  x: number
  y: number
}

const ee = new EventEmitter()
const container = document.getElementById('workspace') as HTMLElement
const sandboxCanvas = document.createElement('canvas')
const canvas = sandboxCanvas.getContext('2d', {
  alpha: false,
}) as CanvasRenderingContext2D
const DEFAULT_FONT = 'JetBrains Mono'
const DEFAULT_FONT_SIZE = 14
const DEFAULT_LINESPACE = 14 / 2

merge(container.style, {
  display: 'flex',
  flex: '1',
  position: 'relative',
  background: 'var(--background-30)',
})

export const font: Font = {
  face: DEFAULT_FONT,
  size: DEFAULT_FONT_SIZE,
  lineSpace: DEFAULT_LINESPACE,
}

export const pad: Pad = {
  x: 4,
  y: 8,
}

export const cell: Cell = {
  width: 0,
  height: 0,
  padding: 0,
}

export const size = {
  rows: 0,
  cols: 0,
  height: 0,
  width: 0,
  get nameplateHeight() {
    return cell.height + 4
  },
}

const getCharWidth = (font: string, size: number): number => {
  let width = canvas.measureText('m').width
  if (ckFont) {
    const id = ckFont.getGlyphIDs('m')[0]
    width = ckFont.getGlyphWidths([id])[0]
  }

  const possibleSize = Math.floor(width)
  // roboto mono is built-in. because font-loading is a bit slow,
  // we have precomputed most common font sizes in advance
  if (font !== DEFAULT_FONT && (size > 3 || size < 54)) return possibleSize

  const floatWidth = Reflect.get(robotoSizes, size + '')
  return floatWidth || possibleSize
}

const setFont = (face: string, size: number, lineSpace: number) => {
  invoke.getFontBytes({ fontName: face }).then((bytes) => {
    const bytesArr = new Uint8Array(bytes)
    ckFont = new ck.Font(
      ck.Typeface.MakeFreeTypeFaceFromData(bytesArr.buffer))

    ckFont.setSize(size)
    ckFont.setSubpixel(true)
    /* const canvas = document.createElement('canvas')
    const ckSurface = ck.MakeCanvasSurface(canvas)!
    const paint = new ck.Paint()
    ckFont.setSize(25)
    paint.setColor(ck.WHITE)
    paint.setAntiAlias(true)
    ckSurface.getCanvas().drawText('wassup yo??', 50, 50, paint, ckFont)
    ckSurface.flush()
    document.body.appendChild(canvas)*/
    // ckSurface.getCanvas().drawText('hello y\'all', 50, 50, paint, ckFont)
    // ckSurface.flush()

    Object.assign(cell, {
      width: getCharWidth(face, size),
      height: Math.floor(size + lineSpace),
    })
  }).catch((err) => console.error('setFont error: ', err))

  setVar('font', face)
  setVar('font-size', size)
  setVar('line-height', lineSpace / size)

  canvas.font = `${size}px ${face}`

  Object.assign(font, { face, size, lineSpace })

  Object.assign(cell, {
    width: getCharWidth(face, size),
    height: Math.floor(size + lineSpace),
  })

  pad.x = Math.round(cell.width / 2)
  pad.y = pad.x + 4

  cell.padding = Math.floor((cell.height - font.size) / 2)
}

export const updateEditorFont = ({
  size,
  lineSpace,
  face,
}: UpdateEditorFontParams) => {
  const fontFace = face || DEFAULT_FONT
  const fontSize =
    !size || isNaN(size) ? (face ? font.size : DEFAULT_FONT_SIZE) : size
  const fontLineSpace =
    !lineSpace || isNaN(lineSpace) ? DEFAULT_LINESPACE : lineSpace

  const same =
    font.face === fontFace &&
    font.size === fontSize &&
    font.lineSpace === fontLineSpace

  if (same) return false
  setFont(fontFace, fontSize, fontLineSpace)
  return true
}

export const resize = () => {
  const { width, height } = container.getBoundingClientRect()
  merge(size, {
    height,
    width,
    rows: Math.floor(height / cell.height) - 1,
    cols: Math.floor(width / cell.width) - 2,
  })

  ee.emit('resize', size)
}

export const redoResize = (rows: number, cols: number) => {
  merge(size, { rows, cols })
  ee.emit('resize', size)
}

export const onResize = (fn: (size: { rows: number; cols: number }) => void) =>
  ee.on('resize', fn)

setFont(DEFAULT_FONT, DEFAULT_FONT_SIZE, font.lineSpace)
setTimeout(() => resize(), 1)

window.addEventListener(
  'resize',
  throttle(() => resize(), 150)
)
