import { merge, simplifyPath } from '../common/utils'
import * as dispatch from './dispatch'
import * as workspace from './workspace'
import { remote } from 'electron'

const macos = process.platform === 'darwin'
let titleBarVisible = false
const titleBar = macos && document.createElement('div')
const title = macos && document.createElement('div')

export const setTitleVisibility = (visible: boolean) => {
  if (!titleBar) return
  titleBarVisible = visible
  titleBar.style.display = visible ? 'flex' : 'none'
  workspace.resize()
}

const typescriptSucks = (el: any, bar: any) => el.prepend(bar)

if (macos) {
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
  typescriptSucks(document.body, titleBar)
  titleBarVisible = true

  remote.getCurrentWindow().on('enter-full-screen', () => {
    setTitleVisibility(false)
    dispatch.pub('window.change')
  })

  remote.getCurrentWindow().on('leave-full-screen', () => {
    setTitleVisibility(true)
    dispatch.pub('window.change')
  })

  window.api.nvimWatchStateFile((_file: string) => {
    // TODO(smolck): How to get api.nvim.state.cwd?
    // const path = simplifyPath(file, api.nvim.state.cwd)
    // ;(title as HTMLElement).innerText = `${path} - uivonim`
  })
} else
  window.api.nvimWatchStateFile((_file: string) => {
    // TODO(smolck): How to get api.nvim.state.cwd?
    // const path = simplifyPath(file, api.nvim.state.cwd)
    // remote.getCurrentWindow().setTitle(`${path} - uivonim`)
  })

export const specs = {
  get height() {
    return titleBarVisible ? 22 : 0
  },
}
