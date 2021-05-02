import { showCursor, hideCursor } from '../cursor'
import { Invokables } from '../../common/ipc'
import { uuid } from '../../common/utils'

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
  setImmediate(async () => window.api.invoke(Invokables.inputFocus))
  document.getElementById('keycomp-textarea')?.focus()
  showCursor()
}

export const vimBlur = () => {
  window.api.invoke(Invokables.inputBlur)
  // TODO(smolck): Should be in a .then() since above is a promise?
  hideCursor()
}
