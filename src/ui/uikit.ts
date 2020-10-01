import { ActionsType, View } from 'hyperapp'
import { showCursor, hideCursor } from '../core/cursor'
import { specs as titleSpecs } from '../core/title'
import * as dispatch from '../messaging/dispatch'
import { merge, uuid } from '../support/utils'
import hyperscript from '../ui/hyperscript'
import * as viminput from '../core/input'
// using our own version of hyperapp patched to fix removeChild errors
const { app: makeApp, h: makeHyperscript } = require('../ui/hyperapp')

export const h = hyperscript(makeHyperscript)

export const css = (builder: (classname: string) => string[]): string => {
  const id = `sc-${uuid()}`
  const styles = builder(id).join('\n')
  const style = document.createElement('style')
  style.type = 'text/css'
  style.appendChild(document.createTextNode(styles))
  document.head.appendChild(style)
  return id
}

const pluginsContainer = document.getElementById('plugins') as HTMLElement
merge(pluginsContainer.style, {
  position: 'absolute',
  display: 'flex',
  width: '100vw',
  zIndex: 420, // vape naysh yall
  // TODO: 24px for statusline. do it better
  // TODO: and title. bruv do i even know css?
  height: `calc(100vh - 24px - ${titleSpecs.height}px)`,
})

dispatch.sub('window.change', () => {
  pluginsContainer.style.height = `calc(100vh - 24px - ${titleSpecs.height}px)`
})

export const vimFocus = () => {
  setImmediate(() => viminput.focus())
  showCursor()
}

export const vimBlur = () => {
  viminput.blur()
  hideCursor()
}

const prepareContainerElement = (name: string) => {
  const el = document.createElement('div')
  el.setAttribute('id', name)
  merge(el.style, {
    position: 'absolute',
    width: '100%',
    height: '100%',
  })

  pluginsContainer.appendChild(el)
  return el
}

interface App<StateT, ActionsT> {
  name: string
  state: StateT
  actions: ActionsType<StateT, ActionsT>
  view: View<StateT, ActionsT>
  element?: HTMLElement
}

/** create app for cultural learnings of hyperapp for make benefit of glorious application veonim */
export const app = <StateT, ActionsT>({
  state,
  actions,
  view,
  element,
  name,
}: App<StateT, ActionsT>): ActionsT => {
  const containerElement = element || prepareContainerElement(name)

  if (process.env.VEONIM_DEV) {
    const devtools = require('@deomitrus/hyperapp-redux-devtools')
    return devtools(makeApp, { name })(state, actions, view, containerElement)
  }

  return makeApp(state, actions, view, containerElement)
}
