import * as windows from '../windows/window-manager'
import { hexToRGB } from '../ui/css'

export enum CursorShape {
  block = 0,
  line = 1,
  underline = 2,
}

export const cursor = {
  visible: true,
  row: 0,
  col: 0,
  color: [0, 0, 0],
  // TODO(smolck): Better naming, probably just switch `color` to be hex
  colorNice: '#eeeeee',
  shape: CursorShape.block,
  size: 20,
}

let cursorEnabled = false
let cursorRequestedToBeHidden = false

// TODO(smolck): For some reason, initially windows may not be defined in full,
// so here we make sure it is before trying to call it to avoid errors
const redraw = () => windows.redrawCursor ? windows.redrawCursor() : {}

export const setCursorShape = (shape: CursorShape, size = 20) => {
  cursor.shape = shape
  cursor.size = size

  redraw()
}

export const setCursorColor = (color: string) => {
  cursor.colorNice = color
  let [r, g, b] = hexToRGB(color)
  r /= 255
  g /= 255
  b /= 255
  cursor.color = [r, g, b]

  redraw()
}

export const enableCursor = () => (cursorEnabled = true)
export const disableCursor = () => (cursorEnabled = false)

export const hideCursor = () => {
  if (!cursorEnabled) return
  cursorRequestedToBeHidden = true

  redraw()
  Object.assign(cursor, { visible: false })
}

export const showCursor = () => {
  if (!cursorEnabled) return
  cursorRequestedToBeHidden = false

  redraw()
  Object.assign(cursor, { visible: true })
}

// TODO(smolck): export const showCursorline = () => (cursorline.style.display = '')

export const moveCursor = (row: number, col: number) => {
  Object.assign(cursor, { row, col })

  if (cursorRequestedToBeHidden) return
  showCursor()
  redraw()
}

setCursorShape(CursorShape.block)
