import * as instanceManager from '../core/instance-manager'
import { requireDir, debounce } from '../support/utils'
import * as nvim from '../core/master-control'
import * as workspace from '../core/workspace'
import { remote } from 'electron'
import '../render/redraw'
import '../core/screen-events'
import { merge } from '../support/utils'
import * as dispatch from '../messaging/dispatch'
import { specs as titleSpecs } from '../core/title'

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
    // Need to focus hacky textarea so input is registered right off the bat.
    document.getElementById('hacky-textarea')?.focus()

    require('../components/nvim/statusline')
    require('../components/nvim/command-line')
    require('../components/experimental/vim-search')
  })

  setTimeout(() => {
    // TODO(smolck): `requireDir` doesn't recursively search through directories
    // for files, right?
    requireDir(`${__dirname}/../components/nvim`)
    requireDir(`${__dirname}/../components/lsp`)
    requireDir(`${__dirname}/../components`)
    requireDir(`${__dirname}/../components/experimental`)
    requireDir(`${__dirname}/../components/memes`)
  }, 600)

  setTimeout(() => {
    // Focus on hacky textarea when clicking main window, since input events are
    // received from that textarea.
    document.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      document.getElementById('hacky-textarea')?.focus()
    })

    require('../services/remote')
    require('../services/app-info')

    if (process.env.VEONIM_DEV) {
      // require('../dev/menu')
      // require('../dev/recorder')
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

const pluginsContainer = document.getElementById('plugins') as HTMLElement
merge(pluginsContainer.style, {
  position: 'absolute',
  display: 'flex',
  width: '100vw',
  zIndex: 420,
  // TODO: 24px for statusline. do it better
  // TODO: and title. bruv do i even know css?
  height: `calc(100vh - 24px - ${titleSpecs.height}px)`,
})

dispatch.sub('window.change', () => {
  pluginsContainer.style.height = `calc(100vh - 24px - ${titleSpecs.height}px)`
})
