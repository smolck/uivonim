import * as windows from '../windows/window-manager'
import { hexToRGB } from '../ui/css'

export enum CursorShape {
  block,
  line,
  underline,
}

export const cursor = {
  color: [0, 0, 0],
  shape: CursorShape.block,
}

let cursorRequestedToBeHidden = false
let cursorEnabled = false
// export const getCursorBoundingClientRect = () =>
  // cursorline.getBoundingClientRect()

export const setCursorShape = (shape: CursorShape) => {
  cursor.shape = shape
}

export const setCursorColor = (color: string) => {
  let [r, g, b] = hexToRGB(color)
  r /= 255
  g /= 255
  b /= 255
  cursor.color = [r, g, b]

  windows.webgl.updateCursorColor(r, g, b)
}

export const enableCursor = () => (windows.webgl.enableCursor(true), cursorEnabled = true)
export const disableCursor = () => (windows.webgl.enableCursor(false), cursorEnabled = false)

export const hideCursor = () => {
  return
  if (!cursorEnabled) return

  console.log('hide cursor')
  windows.webgl.enableCursor(false)
}

export const showCursor = () => {
  return
  if (!cursorEnabled) return

  console.log('show cursor')
  windows.webgl.enableCursor(true)
}

// export const showCursorline = () => (cursorline.style.display = '')

export const moveCursor = (row: number, col: number) => {
  windows.webgl.updateCursorPosition(row, col)
}

setCursorShape(CursorShape.block)
