import { showCursor, hideCursor } from '../cursor'
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

export const vimFocus = () => {
  setTimeout(async () => invoke.inputFocus({}), 1)
  document.getElementById('keycomp-textarea')?.focus()
  showCursor()
}

export const vimBlur = () => {
  invoke.inputBlur({}).then(() => hideCursor())
}
