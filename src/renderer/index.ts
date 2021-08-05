import * as dispatch from './dispatch'
import { CanvasKit } from 'canvaskit-wasm'
import { /*debounce,*/ merge } from '../common/utils'
import { invoke, listen, setCanvasKit } from './helpers'

const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js')
CanvasKitInit().then((CanvasKit: CanvasKit) => {
  setCanvasKit(CanvasKit)

  // TODO(smolck): Yes this is done on purpose, and yes I should probably
  // clean this up: basically, these need to be loaded after canvaskit,
  // so that's why they're (untyped :( ) requires.
  const workspace = require('./workspace')
  const { forceRegenerateFontAtlas } = 
    require('./render/font-texture-atlas')
  const windows = require('./windows/window-manager')

  window
    .matchMedia('screen and (min-resolution: 2dppx)')
    .addEventListener('change', () => {
      const atlas = forceRegenerateFontAtlas()
      windows.webgl.updateFontAtlas(atlas)
      windows.webgl.updateCellSize()
      workspace.resize()
      windows.resetAtlasBounds()
      windows.refreshWebGLGrid()

      // TODO(smolck): Is this still relevant? See handler code in src/main/main.ts
      // TODO: idk why i have to do this but this works
      invoke.winGetAndSetSize({})
    })

  /*let cursorVisible = true
  const hideCursor = debounce(() => {
    cursorVisible = false
    document.body.style.cursor = 'none'
  }, 1500)
  */
  /*const mouseTrap = () => {
    if (!cursorVisible) {
      cursorVisible = true
      document.body.style.cursor = 'default'
    }
    hideCursor()
  }*/

  // TODO(smolck): Figure this out, gonna have stuff on the Tauri side
  /*listen('', (_) =>
    window.addEventListener('mousemove', mouseTrap)
  )
  window.api.on(Events.windowLeaveFullScreen, (_) =>
    window.removeEventListener('mousemove', mouseTrap)
  )*/

  // TODO: temp rows minus 1 because it doesn't fit. we will resize windows
  // individually once we get ext_windows working
  workspace.onResize(({ rows, cols }) => invoke.nvimResize({ cols, rows }))
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

    /*setTimeout(() => {
      require('./components/extensions/buffers')
      require('./components/extensions/color-picker')
      require('./components/extensions/explorer')

      require('./components/extensions/lsp-code-action')
      require('./components/extensions/lsp-hover')
      require('./components/extensions/lsp-references')
      require('./components/extensions/lsp-signature-help')

      require('./components/memes/nc')
    }, 600)*/
  })

  const pluginsContainer = document.getElementById('plugins') as HTMLElement
  merge(pluginsContainer.style, {
    position: 'absolute',
    display: 'flex',
    width: '100vw',
    zIndex: 420,
    // TODO: 24px for statusline. do it better
    // TODO: and title. bruv do i even know css?
    height: `calc(100vh - 24px)`,
  })

  dispatch.sub('window.change', () => {
    pluginsContainer.style.height = `calc(100vh - 24px)`
  })

  listen.nvimShowMessage((...args: any[]) => require('./components/nvim/messages').default.show(...args))
  listen.updateNameplates(windows.refresh)
  // TODO(smolck): ??? -> listen.nvimMessageStatus((..._args) => {})

  document.onclick = (e) => {
    if (document.activeElement === document.body) {
      e.preventDefault()
      document.getElementById('keycomp-textarea')?.focus()
    }
  }

  document.onkeydown = (e: KeyboardEvent) => {
    invoke.documentOnKeydown({
      key: e.key,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
    })
    .catch((_e) => invoke.quit({}))
  }

  // @ts-ignore
  document.oninput = (e: InputEvent) => {
    if (e.data) {
      invoke.documentOnInput({ data: e.data })
      .catch((_e) => invoke.quit({}))
    }
  }
});
