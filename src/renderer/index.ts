import * as workspace from './workspace'
// TODO(smolck): import * as css from './ui/css'
import { specs as titleSpecs } from './title'
import * as dispatch from './dispatch'
import { debounce, merge } from '../common/utils'
import { forceRegenerateFontAtlas } from './render/font-texture-atlas'
import * as windows from './windows/window-manager'
import { Events, Invokables } from '../common/ipc'

window
  .matchMedia('screen and (min-resolution: 2dppx)')
  .addEventListener('change', () => {
    const atlas = forceRegenerateFontAtlas()
    windows.webgl.updateFontAtlas(atlas)
    windows.webgl.updateCellSize()
    workspace.resize()

    // TODO(smolck): Is this still relevant? See handler code in src/main/main.ts
    // TODO: idk why i have to do this but this works
    window.api.invoke(Invokables.winGetAndSetSize)
  })

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

// TODO(smolck): window.api.on(Events.setVar, css.setVar)
window.api.on(Events.windowEnterFullScreen, (_) =>
  window.addEventListener('mousemove', mouseTrap)
)
window.api.on(Events.windowLeaveFullScreen, (_) =>
  window.removeEventListener('mousemove', mouseTrap)
)

// TODO: temp rows minus 1 because it doesn't fit. we will resize windows
// individually once we get ext_windows working
workspace.onResize(({ rows, cols }) =>
  window.api.invoke(Invokables.nvimResize, cols, rows)
)
workspace.resize()

requestAnimationFrame(() => {
  require('./render/redraw')

  // high priority components
  requestAnimationFrame(() => {
    // Focus textarea at start of application to receive input right away.
    document.getElementById('keycomp-textarea')?.focus()

    require('./components/nvim/command-line')
    require('./components/nvim/autocomplete')
    require('./components/nvim/messages')
    require('./components/nvim/message-history')
    require('./components/nvim/search')
    require('./components/nvim/statusline')
  })

  setTimeout(() => {
    require('./components/extensions/buffers')
    require('./components/extensions/color-picker')
    require('./components/extensions/explorer')

    require('./components/extensions/lsp-code-action')
    require('./components/extensions/lsp-hover')
    require('./components/extensions/lsp-references')
    require('./components/extensions/lsp-signature-help')

    require('./components/memes/nc')
  }, 600)

  setTimeout(() => {
    // TODO(smolck): Need to port app-info things
    // require('../services/app-info')
    /*if (process.env.VEONIM_DEV) {
      // require('../dev/menu')
      // require('../dev/recorder')
    }*/
  }, 199)
})

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

window.api.on(Events.nvimShowMessage, (...args) =>
  require('./components/nvim/messages').default.show(...args)
)
window.api.on(Events.nvimMessageStatus, (..._args) => {})
window.api.on(Events.updateNameplates, windows.refresh)

document.onclick = (e) => {
  if (document.activeElement === document.body) {
    e.preventDefault()
    document.getElementById('keycomp-textarea')?.focus()
  }
}

document.onkeydown = (e: KeyboardEvent) => {
  window.api.invoke(Invokables.documentOnKeydown, {
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
  })
}
// @ts-ignore
document.oninput = (e: InputEvent) => {
  window.api.invoke(Invokables.documentOnInput, {
    data: e.data,
    isComposing: e.isComposing,
  })
}
