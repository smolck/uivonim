import { merge, simplifyPath } from '../common/utils'
import { Events } from '../common/ipc'
import * as dispatch from './dispatch'
import * as workspace from './workspace'

let titleBarVisible = false
const titleBar = window.api.isMacos && document.createElement('div')
const title = window.api.isMacos && document.createElement('div')

export const setTitleVisibility = (visible: boolean) => {
  if (!titleBar) return
  titleBarVisible = visible
  titleBar.style.display = visible ? 'flex' : 'none'
  workspace.resize()
}

if (window.api.isMacos) {
  merge((title as HTMLElement).style, {
    fontSize: '14px',
    marginLeft: '20%',
    marginRight: '20%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  })

  merge((titleBar as HTMLElement).style, {
    height: '22px',
    color: 'var(--foreground-60)',
    background: 'var(--background-15)',
    '-webkit-app-region': 'drag',
    '-webkit-user-select': 'none',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  })
  ;(title as HTMLElement).innerText = 'uivonim'
  ;(titleBar as HTMLElement).appendChild(title as HTMLElement)

  document.body.prepend(titleBar as Node)
  titleBarVisible = true

  window.api.on(Events.windowEnterFullScreen, () => {
    setTitleVisibility(false)
    dispatch.pub('window.change')
  })

  window.api.on(Events.windowLeaveFullScreen, () => {
    setTitleVisibility(true)
    dispatch.pub('window.change')
  })

  window.api.nvimWatchState('file', (file: string) => {
    const path = simplifyPath(file, window.api.nvimState().cwd)
    ;(title as HTMLElement).innerText = `${path} - uivonim`
  })
} else
  window.api.nvimWatchState('file', (file: string) => {
    const path = simplifyPath(file, window.api.nvimState().cwd)
    window.api.setWinTitle(`${path} - uivonim`)
  })

export const specs = {
  get height() {
    return titleBarVisible ? 22 : 0
  },
}
