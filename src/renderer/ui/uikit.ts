import { Invokables } from '../../common/ipc'
import { uuid } from '../../common/utils'
import { renderer } from '../windows/window-manager'

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
  setTimeout(async () => window.api.invoke(Invokables.inputFocus), 1)
  document.getElementById('keycomp-textarea')?.focus()
  // TODO(smolck): Make sure this works.
  renderer.showCursor(true)
}

export const vimBlur = () => {
  window.api.invoke(Invokables.inputBlur).then(() => renderer.showCursor(false))
}
