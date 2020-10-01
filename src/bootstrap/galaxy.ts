import * as instanceManager from '../core/instance-manager'
import { requireDir, debounce } from '../support/utils'
import * as nvim from '../core/master-control'
import * as workspace from '../core/workspace'
import { remote } from 'electron'
import '../render/redraw'
import '../core/screen-events'

// TODO: do we need to sync instance nvim state to main thread? see instance-api todo note
// TODO: webgl line width
// TODO: investigate no texture on unit0. im guessing the texture atlas are not
// ready on load?
// TODO: do we still need roboto-sizes.json? we generate the font atlas before
// we can wrender anything to webgl, so we can probably grab the size then

// TODO: temp rows minus 1 because it doesn't fit. we will resize windows
// individually once we get ext_windows working
workspace.onResize(({ rows, cols }) => nvim.resize(cols, rows))
workspace.resize()

requestAnimationFrame(() => {
  instanceManager.createVim('main')

  // high priority components
  requestAnimationFrame(() => {
    require('../components/statusline')
    require('../components/command-line')
    require('../components/vim-search')
  })

  setTimeout(() => {
    require('../services/remote')
    require('../services/app-info')
    requireDir(`${__dirname}/../components`)

    if (process.env.VEONIM_DEV) {
      require('../dev/menu')
      require('../dev/recorder')
    }
  }, 199)
})

const win = remote.getCurrentWindow()

let cursorVisible = true

const hideCursor = debounce(() => {
  cursorVisible = false
  document.body.style.cursor = 'none'
}, 1500)

const mouseTrap = () => {
  if (!cursorVisible) {
    cursorVisible = true
    document.body.style.cursor = 'default'
  }

  hideCursor()
}

win.on('enter-full-screen', () =>
  window.addEventListener('mousemove', mouseTrap)
)
win.on('leave-full-screen', () =>
  window.removeEventListener('mousemove', mouseTrap)
)
