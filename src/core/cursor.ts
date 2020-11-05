import * as windows from '../windows/window-manager'
import { hexToRGB } from '../ui/css'

export enum CursorShape {
  block = 0,
  line = 1,
  underline = 2,
}

export const cursor = {
  row: 0,
  col: 0,
  color: [0, 0, 0],
  shape: CursorShape.block,
  size: 20,
}

let cursorEnabled = false
// export const getCursorBoundingClientRect = () =>
// cursorline.getBoundingClientRect()

export const setCursorShape = (shape: CursorShape, size = 20) => {
  cursor.shape = shape
  cursor.size = size;
}

export const setCursorColor = (color: string) => {
  let [r, g, b] = hexToRGB(color)
  r /= 255
  g /= 255
  b /= 255
  cursor.color = [r, g, b]

  windows.webgl.updateCursorColor(r, g, b)
}

export const enableCursor = () => (cursorEnabled = true)
export const disableCursor = () => (cursorEnabled = false)

export const hideCursor = () => {
  if (!cursorEnabled) return

  windows.webgl.showCursor(false)
}

export const showCursor = () => {
  if (!cursorEnabled) return

  windows.webgl.showCursor(true)
}

// export const showCursorline = () => (cursorline.style.display = '')

export const moveCursor = (row: number, col: number) => {
  Object.assign(cursor, { row, col })
  windows.webgl.updateCursorPosition(row, col)
}

setCursorShape(CursorShape.block)
