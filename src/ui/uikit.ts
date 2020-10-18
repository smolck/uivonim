import { showCursor, hideCursor } from '../core/cursor'
import { uuid } from '../support/utils'
import * as viminput from '../core/input'

export const css = (builder: (classname: string) => string[]): string => {
  const id = `sc-${uuid()}`
  const styles = builder(id).join('\n')
  const style = document.createElement('style')
  style.type = 'text/css'
  style.appendChild(document.createTextNode(styles))
  document.head.appendChild(style)
  return id
}

export const vimFocus = () => {
  setImmediate(() => viminput.focus())
  showCursor()
}

export const vimBlur = () => {
  viminput.blur()
  hideCursor()
}
