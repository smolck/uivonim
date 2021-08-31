import { hexToRGB } from './ui/css'
import { CursorShape } from '../common/types'
import CreateWebGLRenderer from '../renderer/render/webgl/renderer'


export default class Cursor {
  private _visible: boolean
  private _row: number
  private _col: number

  private enabled: boolean
  private requestedToBeHidden: boolean
  private _shape: CursorShape
  private _size: number
  private _color: [number, number, number]

  private rendererRef: ReturnType<typeof CreateWebGLRenderer>

  constructor(renderer: ReturnType<typeof CreateWebGLRenderer>) {
    this._visible = false
    this._row = 0
    this._col = 0
    this._color = [0, 0, 0]
    this._shape = CursorShape.block
    this._size = 20

    this.enabled = false
    this.requestedToBeHidden = false
    this.rendererRef = renderer
  }

  // TODO(smolck): UGH GETTERS
  get visible() {
    return this._visible
  }

  get row() {
    return this._row
  }

  get col() {
    return this._col
  }

  get color() {
    return this._color
  }

  get size() {
    return this._size
  }

  get shape() {
    return this._shape
  }

  setShape(shape: string, size = 20) {
    this._shape =
      shape === 'block'
        ? CursorShape.block
        : shape === 'horizontal'
        ? CursorShape.underline
        : shape === 'vertical'
        ? CursorShape.line
        : CursorShape.block
    this._size = size

    this.rendererRef.updateCursorShape(this._shape)
  }

  setColor(color: string) {
    let [r, g, b] = hexToRGB(color)
    r /= 255
    g /= 255
    b /= 255
    this._color = [r, g, b]

    this.rendererRef.updateCursorColor(r, g, b)
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  hide() {
    if (!this.enabled) return
    this.requestedToBeHidden = true

    this.rendererRef.showCursor(false)
    this._visible = false
  }

  show() {
    if (!this.enabled) return
    this.requestedToBeHidden = false

    this.rendererRef.showCursor(true)
    this._visible = true
  }

  moveTo(row: number, col: number) {
    this._row = row
    this._col = col

    if (!this.requestedToBeHidden) {
      this.rendererRef.updateCursorPosition(row, col)
      this.show()
    }
  }
}

// TODO(smolck): export const showCursorline = () => (cursorline.style.display = '')
