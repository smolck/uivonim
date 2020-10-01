import * as windows from '../windows/window-manager'
import { partialFill, translate } from '../ui/css'
import { paddingX } from '../windows/window'
import { cell } from '../core/workspace'

export enum CursorShape {
  block,
  line,
  underline,
}

export const cursor = {
  row: 0,
  col: 0,
  color: '#fff',
  shape: CursorShape.block,
}

const cursorEl = document.getElementById('cursor') as HTMLElement
const cursorChar = document.createElement('span')
const cursorline = document.getElementById('cursorline') as HTMLElement
export const debugline = document.getElementById('debugline') as HTMLElement
let cursorRequestedToBeHidden = false
let cursorEnabled = true
let cursorCharVisible = true

Object.assign(cursorline.style, {
  background: 'rgba(var(--background-alpha), 0.2)',
  position: 'absolute',
  mixBlendMode: 'screen',
  height: `${cell.height}px`,
  zIndex: 60,
})

Object.assign(debugline.style, {
  display: 'none',
  position: 'absolute',
  mixBlendMode: 'screen',
  height: `${cell.height}px`,
  zIndex: 60,
})

Object.assign(cursorEl.style, {
  zIndex: 70,
  position: 'absolute',
  display: 'none',
  justifyContent: 'center',
  alignItems: 'center',
})

Object.assign(cursorChar.style, {
  filter: 'invert(1) grayscale(1)',
  fontFamily: 'var(--font)',
  fontSize: 'calc(var(--font-size) * 1px)',
})

cursorEl.appendChild(cursorChar)

export const getCursorBoundingClientRect = () =>
  cursorline.getBoundingClientRect()

export const setCursorShape = (shape: CursorShape, size = 20) => {
  cursor.shape = shape

  if (shape === CursorShape.block)
    Object.assign(cursorEl.style, {
      background: cursor.color,
      height: `${cell.height}px`,
      width: `${cell.width}px`,
    })

  if (shape === CursorShape.line)
    Object.assign(cursorEl.style, {
      background: cursor.color,
      height: `${cell.height}px`,
      width: `${(cell.width * (size / 100)).toFixed(2)}px`,
    })

  if (shape === CursorShape.underline)
    Object.assign(cursorEl.style, {
      background: partialFill('horizontal', cursor.color, size),
      height: `${cell.height}px`,
      width: `${cell.width}px`,
    })
}

export const setCursorColor = (color: string) => {
  cursorChar.style.color = color
  cursor.color = color
  cursorEl.style.background = color
}

export const enableCursor = () => (cursorEnabled = true)
export const disableCursor = () => (cursorEnabled = false)

export const hideCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = true
  cursorEl.style.display = 'none'
  cursorline.style.display = 'none'
}

export const showCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = false
  cursorEl.style.display = 'flex'
  cursorline.style.display = 'none'
}

export const showCursorline = () => (cursorline.style.display = '')

export const updateCursorChar = () => {
  cursorChar.innerText =
    cursor.shape === CursorShape.block
      ? windows.getActive().editor.getChar(cursor.row, cursor.col)
      : ''

  if (cursor.shape === CursorShape.block && !cursorCharVisible)
    cursorChar.style.display = ''
}

const updateCursorCharInternal = (gridId: number, row: number, col: number) => {
  if (cursor.shape !== CursorShape.block) {
    cursorChar.style.display = 'none'
    cursorCharVisible = false
    cursorChar.innerText = ''
    return
  }

  const char = windows.get(gridId).editor.getChar(row, col)
  cursorChar.innerText = char
  cursorChar.style.display = ''
  cursorCharVisible = true
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

  cursorEl.style.transform = translate(cursorPos.x, cursorPos.y)

  Object.assign(cursorline.style, {
    transform: translate(linePos.x - paddingX, linePos.y),
    width: `${width}px`,
    height: `${cell.height}px`,
  })

  updateCursorCharInternal(gridId, row, col)

  if (cursorRequestedToBeHidden) return
  showCursor()
}

setCursorShape(CursorShape.block)
