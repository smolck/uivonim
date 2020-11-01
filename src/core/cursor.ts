import * as windows from '../windows/window-manager'
import { partialFill, translate } from '../ui/css'
import { paddingX } from '../windows/window'
import { cell } from '../core/workspace'
import { hexToRGB } from '../ui/css'

export enum CursorShape {
  block,
  line,
  underline,
}

export const cursor = {
  row: 0,
  col: 0,
  color: [0, 0, 0],
  shape: CursorShape.block,
}

let cursorRequestedToBeHidden = false
let cursorEnabled = false
let cursorCharVisible = false

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

  console.log('update cursor color', color, `rgb: ${r}, ${g}, ${b}`)
  windows.webgl.updateCursorColor(r, g, b)
}

export const enableCursor = () => (cursorEnabled = false)
export const disableCursor = () => (cursorEnabled = false)

export const hideCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = true
  // cursorEl.style.display = 'none'
  // cursorline.style.display = 'none'
}

export const showCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = false
  // cursorEl.style.display = 'flex'
  // cursorline.style.display = 'none'
}

export const showCursorline = () => (cursorline.style.display = '')

export const updateCursorChar = () => {
  // cursorChar.innerText =
  //   cursor.shape === CursorShape.block
  //     ? windows.getActive().editor.getChar(cursor.row, cursor.col)
  //     : ''

  // if (cursor.shape === CursorShape.block && !cursorCharVisible)
  //   cursorChar.style.display = ''
}

const updateCursorCharInternal = (gridId: number, row: number, col: number) => {
  // if (cursor.shape !== CursorShape.block) {
  //   cursorChar.style.display = 'none'
  //   cursorCharVisible = false
  //   cursorChar.innerText = ''
  //   return
  // }

  // const char = windows.get(gridId).editor.getChar(row, col)
  // cursorChar.innerText = char
  // cursorChar.style.display = ''
  // cursorCharVisible = true
}

export const moveCursor = (gridId: number, row: number, col: number) => {
  Object.assign(cursor, { row, col })

  // even if cursor(line) is hidden, we still need to update the positions.
  // once the cursor elements are re-activated, the position updated while
  // hidden must be accurate. (e.g. using jumpTo() in grep/references/etc)
  const win = windows.get(gridId)
  const cursorPos = win.positionToWorkspacePixels(row, col)
  const linePos = win.positionToWorkspacePixels(row, 0)
  const { width } = win.getWindowSize()

  // cursorEl.style.transform = translate(cursorPos.x, cursorPos.y)

  // Object.assign(cursorline.style, {
  //   transform: translate(linePos.x - paddingX, linePos.y),
  //   width: `${width}px`,
  //   height: `${cell.height}px`,
  // })

  updateCursorCharInternal(gridId, row, col)

  if (cursorRequestedToBeHidden) return
  showCursor()
}

setCursorShape(CursorShape.block)
