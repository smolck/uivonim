import * as workspace from './workspace'
import * as css from './ui/css' 
import { specs as titleSpecs } from './title'

// TODO(smolck): Remember, requireDir won't even be a thing probably, need to
// remove it, since no require in render thread
import { /*requireDir,*/ debounce, merge } from './support/utils'


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

const handlers: any = {
  'setVar': css.setVar,
  'window-enter-full-screen': () => window.addEventListener('mousemove', mouseTrap),
  'window-leave-full-screen': () => window.removeEventListener('mousemove', mouseTrap),
}

// TODO: temp rows minus 1 because it doesn't fit. we will resize windows
// individually once we get ext_windows working
workspace.onResize(({ rows, cols }) => window.api.send('toMain', ['nvim.resize', cols, rows]))
workspace.resize()

window.api.receive('fromMain', ([event, ...args]: [string, ...any]) => {
  handlers[event](...args)
})

// TODO(smolck): Need to re-architect all this because `require` won't be available 
// from renderer thread . . .
/* requestAnimationFrame(() => {
  require('../render/redraw')

  // high priority components
  requestAnimationFrame(() => {
    // Focus textarea at start of application to receive input right away.
    document.getElementById('keycomp-textarea')?.focus()

    requireDir(`${__dirname}/../components/nvim`)
  })

  setTimeout(() => {
    requireDir(`${__dirname}/../components`)
    requireDir(`${__dirname}/../components/extensions`)
    requireDir(`${__dirname}/../components/memes`)
  }, 600)

  setTimeout(() => {
    require('../services/app-info')

    if (process.env.VEONIM_DEV) {
      // require('../dev/menu')
      // require('../dev/recorder')
    }
  }, 199)
})*/

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

// TODO(smolck): Need to render process IPC stuff for this probably
/*dispatch.sub('window.change', () => {
  pluginsContainer.style.height = `calc(100vh - 24px - ${titleSpecs.height}px)`
})

// TODO(smolck): Put this somewhere else?
api.onAction(
  'update-nameplates',
  () => (windows.refresh(), console.log('refresh'))
)*/
