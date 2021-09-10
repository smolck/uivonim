import { Surface, Canvas, CanvasKit, Paint, Color } from 'canvaskit-wasm'
import Workspace from '../workspace'

export interface AtlasCharBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface AtlasChar {
  idx: number
  char: string
  isDoubleWidth: boolean
  bounds: AtlasCharBounds
}

// https://stackoverflow.com/a/12057594
const isEmpty = (map: Map<string, AtlasChar>) => {
  for (const _ of map) {
    return false
  }

  return true
}

export default class FontTextureAtlas {
  private canvasElement: HTMLCanvasElement
  private workspaceRef: Workspace

  private canvas: Canvas
  private surface: Surface
  private paint: Paint

  private charsInAtlas: Map<string, AtlasChar>
  private charsQueue: Map<string, AtlasChar>
  private charsByIdx: Map<number, AtlasChar>
  private charsIdx: number
  private nextBounds: AtlasCharBounds | undefined

  private width: number

  private bgColorStoredBecauseReasons: Color

  constructor(
    workspace: Workspace,
    canvasKit: CanvasKit,
    atlasWidth = 1000,
    atlasHeight = 500
  ) {
    this.bgColorStoredBecauseReasons = canvasKit.TRANSPARENT
    this.canvasElement = document.createElement('canvas')!

    this.setCanvasWidth(atlasWidth, atlasHeight)
    this.width = atlasWidth

    this.workspaceRef = workspace
    this.surface = canvasKit.MakeSWCanvasSurface(this.canvasElement)!

    this.canvas = this.surface.getCanvas()
    this.canvas.scale(window.devicePixelRatio, window.devicePixelRatio)

    this.paint = new canvasKit.Paint()
    this.paint.setColor(canvasKit.WHITE)

    this.charsIdx = 0
    this.charsInAtlas = new Map()
    this.charsQueue = new Map()
    this.charsByIdx = new Map()

    // ASCII charset
    for (let ix = 32; ix < 127; ix++) {
      this.getChar(String.fromCharCode(ix), false)
    }
  }

  private updateNextBounds(isDoubleWidth: boolean) {
    if (!this.nextBounds) throw new Error('nextBounds not defined font atlas')

    const cell = this.workspaceRef.cell

    const oldBounds = this.nextBounds
    const moveDown =
      oldBounds.right + (isDoubleWidth ? cell.width * 2 : cell.width) >=
      this.canvasElement.width

    const paddingY = 5
    const paddingX = 2
    const charHeight = cell.height + paddingY
    const charWidth = (isDoubleWidth ? cell.width * 2 : cell.width) + paddingX

    this.nextBounds = moveDown
      ? {
          left: 0,
          right: charWidth,
          top: oldBounds.top + charHeight,
          bottom: oldBounds.bottom + charHeight,
        }
      : {
          left: oldBounds.left + charWidth,
          right: oldBounds.right + charWidth,
          top: oldBounds.top,
          bottom: oldBounds.bottom,
        }
  }

  setCanvasWidth(width: number, height: number) {
    this.canvasElement.width = Math.floor(width * window.devicePixelRatio)
    this.canvasElement.height = Math.floor(height * window.devicePixelRatio)
  }

  getChar(char: string, isDoubleWidth: boolean = false) {
    const maybeChar = this.charsInAtlas.get(char) || this.charsQueue.get(char)
    if (maybeChar) return maybeChar

    // Char isn't in font atlas, so let's add it.
    const idx = this.charsIdx++
    let newChar
    if (this.nextBounds) {
      newChar = {
        char,
        isDoubleWidth,
        bounds: this.nextBounds,
        idx,
      }

      this.charsQueue.set(char, newChar)
      this.updateNextBounds(isDoubleWidth)
    } else {
      // First char in font atlas

      const cell = this.workspaceRef.cell
      const width = isDoubleWidth ? cell.width * 2 : cell.width

      const bounds = {
        left: 0,
        right: width,
        top: 0,
        bottom: cell.height,
      }

      // `updateNextBounds` needs `nextBounds` to be defined
      this.nextBounds = bounds
      this.updateNextBounds(isDoubleWidth)

      newChar = {
        char,
        idx,
        isDoubleWidth,
        bounds,
      }

      this.charsQueue.set(char, newChar)
    }

    this.charsByIdx.set(idx, newChar)
    return newChar
  }

  getCharFromIndex(idx: number) {
    return this.charsByIdx.get(idx)
  }

  private genAtlas(redrawWithAllCharsInAtlas: boolean) {
    const draw = (char: AtlasChar, charStr: string) => {
      // const charWidth = char.isDoubleWidth ? cell.width * 2 : cell.width
      const x = char.bounds.left
      const y = char.bounds.bottom + 3

      // TODO(smolck): Why is position different with CanvasKit?
      this.canvas.drawText(
        charStr,
        x,
        y + 10,
        this.paint,
        this.workspaceRef.font
      )
      this.charsInAtlas.set(charStr, char)
    }

    this.charsQueue.forEach(draw)
    if (redrawWithAllCharsInAtlas) {
      this.canvas.clear(this.bgColorStoredBecauseReasons)
      this.charsInAtlas.forEach(draw)
    }

    this.surface.flush()

    this.charsQueue.clear()
  }

  getUpdatedFontAtlasMaybe() {
    if (!isEmpty(this.charsQueue)) {
      this.genAtlas(false)
      return this.canvasElement
    }
  }

  getFontAtlasAndMaybeUpdate() {
    if (!isEmpty(this.charsQueue)) {
      this.genAtlas(false)
    }
    return this.canvasElement
  }

  /** To be used when the workspace font has changed */
  forceRegenerateFontAtlas() {
    // All the bounds are invalidated, so need to redo those as well.
    const chars: [boolean, number, string][] = []
    this.charsInAtlas.forEach((atlasChar, charStr) =>
      chars.push([atlasChar.isDoubleWidth, atlasChar.idx, charStr])
    )
    this.charsQueue.forEach((atlasChar, charStr) =>
      chars.push([atlasChar.isDoubleWidth, atlasChar.idx, charStr])
    )
    this.charsInAtlas.clear()
    this.charsQueue.clear()
    this.nextBounds = undefined

    this.canvasElement.width = Math.floor(this.width * window.devicePixelRatio)
    this.canvas.scale(window.devicePixelRatio, window.devicePixelRatio)
    // ctx.font = `${font.size}px ${font.face}`
    // ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    // ctx.textBaseline = 'top'
    // ctx.fillStyle = 'white'

    chars.forEach(([doubleWidth, charIdx, char]) => {
      const newChar = this.getChar(char, doubleWidth)
      // The index it receives from `getChar` isn't what it originally had,
      // so set that.
      // TODO(smolck): Potential source of issues that `charsIdx` isn't
      // updated/reset?
      newChar.idx = charIdx
      this.charsByIdx.set(charIdx, newChar)
    })

    this.genAtlas(true)
    return this.canvasElement
  }
}
