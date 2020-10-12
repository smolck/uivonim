import { divinationSearch } from '../components/divination'
import { app, h, vimBlur, vimFocus } from '../ui/uikit'
import * as windows from '../windows/window-manager'
import { WindowOverlay } from '../windows/window'
import Input from '../components/text-input'
import { rgba, paddingV } from '../ui/css'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { makel } from '../ui/vanilla'

interface FilterResult {
  line: string
  start: {
    line: number
    column: number
  }
  end: {
    line: number
    column: number
  }
}

let displayTargetJumps = true
const state = { value: '', focus: false }
let hlid: number
let pattern = ''

type S = typeof state

const searchInBuffer = async (results = [] as FilterResult[]) => {
  if (!results.length) {
    if (hlid) api.nvim.removeHighlightSearch(hlid)
    return api.nvim.cmd('nohlsearch')
  }

  const parts = results
    .map((m) => m.line.slice(m.start.column, m.end.column + 1))
    .filter((m, ix, arr) => arr.indexOf(m) === ix)
    .filter((m) => m)
    .map((m) => m.replace(/[\*\/\^\$\.\~\&]/g, '\\$&'))

  pattern = parts.join('\\|')
  if (!pattern) return api.nvim.cmd('nohlsearch')

  const id = await api.nvim.highlightSearchPattern(pattern, hlid)
  if (!hlid) hlid = id
}

let winOverlay: WindowOverlay

const actions = {
  show: () => {
    vimBlur()
    winOverlay = windows.getActive().addOverlayElement(containerEl)
    return { focus: true }
  },
  hide: () => {
    vimFocus()
    if (winOverlay) winOverlay.remove()
    return { value: '', focus: false }
  },
  change: (value: string) => (s: S) => {
    api.bufferSearchVisible(value).then((results: FilterResult[]) => {
      displayTargetJumps = results.length > 2
      searchInBuffer(results)
    })

    if (!s.value && value) api.nvim.cmd('nohlsearch')

    return { value }
  },
  select: () => (s: S) => {
    vimFocus()

    if (s.value) {
      const patternCommand = `/\\%>${api.nvim.state.editorTopLine - 1}l\\%<${
        api.nvim.state.editorBottomLine + 1
      }l${pattern}`
      api.nvim.removeHighlightSearch(hlid, patternCommand)
    }

    if (winOverlay) winOverlay.remove()
    if (displayTargetJumps) divinationSearch()
    else api.nvim.cmd(`norm! n`)

    return { value: '', focus: false }
  },
}

type A = typeof actions

const view = ($: S, a: A) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        flex: 1,
      },
    },
    [
      ,
      h(
        'div',
        {
          style: {
            ...paddingV(20),
            display: 'flex',
            alignItems: 'center',
            // TODO: figure out a good color from the colorscheme... StatusLine?
            background: rgba(217, 150, 255, 0.17),
          },
        },
        [, h('span', 'viewport search')]
      ),

      Input({
        small: true,
        focus: $.focus,
        value: $.value,
        desc: 'search query',
        icon: Icon.Search,
        hide: a.hide,
        change: a.change,
        select: a.select,
      }),
    ]
  )

const containerEl = makel({
  position: 'absolute',
  width: '100%',
  display: 'flex',
  background: 'var(--background-30)',
})

const ui = app<S, A>({
  name: 'viewport-search',
  state,
  actions,
  view,
  element: containerEl,
})

api.onAction('viewport-search', () => ui.show())
api.onAction('viewport-search-visual', async () => {
  await api.nvim.feedkeys('gv"zy')
  const selection = await api.nvim.expr('@z')
  ui.show()
  ui.change(selection)
})

export default ui.show
