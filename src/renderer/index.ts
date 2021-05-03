import * as workspace from './workspace'
// TODO(smolck): import * as css from './ui/css'
import { specs as titleSpecs } from './title'
import * as dispatch from './dispatch'
// TODO(smolck): I think webpack will fix all the require things?
import { /*requireDir,*/ debounce, merge } from '../common/utils'
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

// TODO(smolck): Need to re-architect all this because `require` won't be available
// from renderer thread . . .
requestAnimationFrame(() => {
  require('./render/redraw')

  // high priority components
  requestAnimationFrame(() => {
    // Focus textarea at start of application to receive input right away.
    document.getElementById('keycomp-textarea')?.focus()

    require('./components/nvim/messages')
    require('./components/nvim/message-history')
    require('./components/nvim/command-line')
    // requireDir(`${__dirname}/components/nvim`)
  })

  setTimeout(() => {
    // requireDir(`${__dirname}/components`)
    // requireDir(`${__dirname}/components/extensions`)
    // requireDir(`${__dirname}/components/memes`)
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

window.api.on(Events.nvimShowMessage, (..._args) => {
  // TODO(smolck)
  // const msg = require('../components/nvim/messages').default.show(...a)
  // return msg.promise
})

window.api.on(Events.nvimMessageStatus, (..._args) => {})

// TODO(smolck): Put this somewhere else?
/*api.onAction(
  'update-nameplates',
  () => (windows.refresh(), console.log('refresh'))
)*/

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
    shiftKey: e.shiftKey
  })
}
// @ts-ignore
document.oninput = (e: InputEvent) => {
  window.api.invoke(Invokables.documentOnInput, {
    data: e.data,
    isComposing: e.isComposing,
  })
}