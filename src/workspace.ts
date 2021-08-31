import { throttle } from './utils'
import robotoSizes from './roboto-sizes'
import { EventEmitter } from 'events'
import { setVar } from './ui/css'
import { invoke } from './helpers'
import { Font as CkFont, CanvasKit } from 'canvaskit-wasm'

const DEFAULT_FONT = 'JetBrains Mono'
const DEFAULT_FONT_SIZE = 14
const DEFAULT_LINESPACE = 14 / 2

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

interface Size {
  rows: number
  cols: number
  width: number
  height: number
}

export default class Workspace {
  readonly font: CkFont
  readonly fontDesc: Font
  readonly ee: EventEmitter
  readonly size: Size
  readonly cell: Cell
  readonly container: HTMLElement
  readonly canvasKitRef: CanvasKit
  readonly pad: Pad

  constructor(CanvasKit: CanvasKit) {
    this.pad = {
      x: 4,
      y: 8,
    }
    this.canvasKitRef = CanvasKit
    this.fontDesc = {
      face: DEFAULT_FONT,
      size: DEFAULT_FONT_SIZE,
      lineSpace: DEFAULT_LINESPACE,
    }
    this.ee = new EventEmitter()
    this.font = new CanvasKit.Font()
    this.cell = {
      width: 0,
      height: 0,
      padding: 0,
    }
    this.size = {
      rows: 0,
      cols: 0,
      height: 0,
      width: 0,
    }

    this.container = document.getElementById('workspace')!
  }

  setFontToDefault() {
    this.setFont(DEFAULT_FONT, DEFAULT_FONT_SIZE, this.fontDesc.lineSpace)
    setTimeout(() => this.resize(), 1)
  }

  get nameplateHeight() {
    return this.cell.height + 4
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect()
    this.size.height = height
    this.size.width = width
    this.size.rows = Math.floor(height / this.cell.height) - 1
    this.size.cols = Math.floor(width / this.cell.width) - 2

    this.ee.emit('resize', this.size)
  }

  setupResizeHandler() {
    window.addEventListener(
      'resize',
      throttle(() => this.resize(), 150)
    )
  }

  getCharWidth(font: string, size: number) {
    const id = this.font.getGlyphIDs('m')[0]
    const width = this.font.getGlyphWidths([id])[0]

    const possibleSize = Math.floor(width)
    // roboto mono is built-in. because font-loading is a bit slow,
    // we have precomputed most common font sizes in advance
    if (font !== DEFAULT_FONT && (size > 3 || size < 54)) return possibleSize

    const floatWidth = Reflect.get(robotoSizes, size + '')
    return floatWidth || possibleSize
  }

  private async setFont(face: string, size: number, lineSpace: number) {
    try {
      const bytes = await invoke.getFontBytes({ fontName: face })
      const bytesArr = new Uint8Array(bytes)
      this.font.setTypeface(this.canvasKitRef.Typeface.MakeFreeTypeFaceFromData(bytesArr.buffer))
    } catch (e) {
      console.error(`couldn't set font to ${face}, '${e}'`)
    }

    this.font.setSize(size)
    // TODO(smolck): this.font.setSubpixel(true)
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

    Object.assign(this.cell, {
      width: this.getCharWidth(face, size),
      height: Math.floor(size + lineSpace),
    })

    setVar('font', face)
    setVar('font-size', size)
    setVar('line-height', lineSpace / size)

    Object.assign(this.fontDesc, { face, size, lineSpace })
    Object.assign(this.cell, {
      width: this.getCharWidth(face, size),
      height: Math.floor(size + lineSpace),
    })

    this.pad.x = Math.round(this.cell.width / 2)
    this.pad.y = this.pad.x + 4

    this.cell.padding = Math.floor((this.cell.height - this.fontDesc.size) / 2)
  }

  async updateEditorFont({
    size,
    lineSpace,
    face,
  }: UpdateEditorFontParams) {
    const fontFace = face || DEFAULT_FONT
    const fontSize =
      !size || isNaN(size) ? (face ? this.fontDesc.size : DEFAULT_FONT_SIZE) : size
    const fontLineSpace =
      !lineSpace || isNaN(lineSpace) ? DEFAULT_LINESPACE : lineSpace

    const same =
      this.fontDesc.face === fontFace &&
      this.fontDesc.size === fontSize &&
      this.fontDesc.lineSpace === fontLineSpace

    if (same) return false
    await this.setFont(fontFace, fontSize, fontLineSpace)
    return true
  }

  onResize(fn: (size: { rows: number; cols: number }) => void) {
    this.ee.on('resize', fn)
  }
}
