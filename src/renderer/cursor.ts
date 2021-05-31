// import * as windows from './windows/window-manager'
import { hexToRGB } from './ui/css'
import { CursorShape } from '../common/types'

export const cursor = {
  visible: false,
  row: 0,
  col: 0,
  color: [0, 0, 0] as [number, number, number],
  shape: CursorShape.block,
  size: 20,
}

let cursorEnabled = false
let cursorRequestedToBeHidden = false

export const setCursorShape = (shape: CursorShape, size = 20) => {
  cursor.shape = shape
  cursor.size = size

  // TODO(smolck): windows.webgl?.updateCursorShape(shape)
}

export const setCursorColor = (color: string) => {
  let [r, g, b] = hexToRGB(color)
  r /= 255
  g /= 255
  b /= 255
  cursor.color = [r, g, b]

  // TODO(smolck): windows.webgl?.updateCursorColor(r, g, b)
}

export const enableCursor = () => (cursorEnabled = true)
export const disableCursor = () => (cursorEnabled = false)

export const hideCursor = () => {
  if (!cursorEnabled) return
  cursorRequestedToBeHidden = true

  // TODO(smolck): windows.webgl?.showCursor(false)
  Object.assign(cursor, { visible: false })
}

export const showCursor = () => {
  if (!cursorEnabled) return
  cursorRequestedToBeHidden = false

  // TODO(smolck): windows.webgl?.showCursor(true)
  Object.assign(cursor, { visible: true })
}

// TODO(smolck): export const showCursorline = () => (cursorline.style.display = '')

export const moveCursor = (row: number, col: number) => {
  Object.assign(cursor, { row, col })

  if (cursorRequestedToBeHidden) return
  showCursor()
  // TODO(smolck): windows.webgl?.updateCursorPosition(row, col)
}

setCursorShape(CursorShape.block)
