import Cursor from '../cursor'
import { invoke } from '../helpers'
import { uuid } from '../utils'

export const css = (builder: (classname: string) => string[]): string => {
  const id = `sc-${uuid()}`
  const styles = builder(id).join('\n')
  const style = document.createElement('style')
  style.type = 'text/css'
  style.appendChild(document.createTextNode(styles))
  document.head.appendChild(style)
  return id
}

export const vimFocus = (cursor: Cursor) => {
  setTimeout(async () => invoke.inputFocus({}), 1)
  document.getElementById('keycomp-textarea')?.focus()
  cursor.show()
}

export const vimBlur = (cursor: Cursor) => {
  invoke.inputBlur({}).then(() => cursor.hide())
}
