import colorizer, { ColorData } from '../services/colorizer'
import { getCursorBoundingClientRect } from '../core/cursor'
import { RowNormal } from '../components/row-container'
import { app, h, vimBlur, vimFocus } from '../ui/uikit'
import * as windows from '../windows/window-manager'
import { WindowOverlay } from '../windows/window'
import { showCursorline } from '../core/cursor'
import Input from '../components/text-input'
import { merge } from '../support/utils'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { makel } from '../ui/vanilla'
import { cvar } from '../ui/css'

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

interface ColorizedFilterResult extends FilterResult {
  colorizedLine: ColorData[]
}

const cursor = (() => {
  let restoreCursorPosition = () => {}

  const restore = () => restoreCursorPosition()
  const save = async () => {
    restoreCursorPosition = await api.nvim.saveCursor()
  }

  return { save, restore }
})()

let elPosTop = 0

const captureOverlayPosition = () =>
  setImmediate(() => {
    // const { top } = element.getBoundingClientRect()
    const { top } = containerEl.getBoundingClientRect()
    elPosTop = top
  })

const checkReadjustViewport = () =>
  setTimeout(() => {
    // not the most performant
    // i tried using IntersectionObserver but it did not work i think because
    // both observed elements are absolutely positioned. all examples i've seen
    // are about detecting elements scrolling in/out of the viewport
    const { top } = getCursorBoundingClientRect()
    const hidden = top > elPosTop
    if (hidden) api.nvim.feedkeys('zz')
  }, 10)

const state = {
  results: [] as ColorizedFilterResult[],
  visible: false,
  query: '',
  index: 0,
}

const previousSearchCache = state

type S = typeof state

const resetState = { visible: false, query: '', results: [], index: 0 }

const jumpToResult = (
  state: S,
  index: number,
  { readjustViewport = false } = {}
) => {
  const location = state.results[index]
  if (!location) return
  api.nvim.jumpTo(location.start)
  showCursorline()
  if (readjustViewport) checkReadjustViewport()
}

let winOverlay: WindowOverlay

const actions = {
  hide: () => (s: S) => {
    cursor.restore()
    if (winOverlay) winOverlay.remove()
    merge(previousSearchCache, s)
    vimFocus()
    return resetState
  },
  show: (resumeState?: S) => {
    winOverlay = windows.getActive().addOverlayElement(containerEl)
    cursor.save()
    captureOverlayPosition()
    vimBlur()
    return resumeState || { visible: true }
  },
  select: () => (s: S) => {
    jumpToResult(s, s.index)
    if (winOverlay) winOverlay.remove()
    merge(previousSearchCache, s)
    vimFocus()
    return resetState
  },
  change: (query: string) => (_: S, a: A) => {
    api
      .bufferSearch(api.nvim.state.absoluteFilepath, query)
      .then(async (res: FilterResult[]) => {
        if (!res.length) return a.updateResults([])

        const textLines = res.map((m) => m.line)
        const coloredLines: ColorData[][] = await colorizer.request.colorizePerChar(
          textLines,
          api.nvim.state.filetype
        )

        const lines = coloredLines
          .filter((m) => m.length)
          .map((m, ix) => ({
            colorizedLine: m,
            ...res[ix],
          }))

        a.updateResults(lines)
      })
    return { query }
  },
  updateResults: (results: ColorizedFilterResult[]) => (s: S) => {
    jumpToResult(s, 0, { readjustViewport: true })
    return { results, index: 0 }
  },
  next: () => (s: S) => {
    if (!s.results.length) return

    const index = s.index + 1 > s.results.length - 1 ? 0 : s.index + 1
    jumpToResult(s, index, { readjustViewport: true })
    return { index }
  },
  prev: () => (s: S) => {
    if (!s.results.length) return

    const index = s.index - 1 < 0 ? s.results.length - 1 : s.index - 1
    jumpToResult(s, index, { readjustViewport: true })
    return { index }
  },
}

type A = typeof actions

const view = ($: S, a: A) =>
  h(
    'div',
    {
      style: {
        display: $.visible ? 'flex' : 'none',
        flexFlow: 'column',
        flex: 1,
      },
    },
    [
      ,
      Input({
        hide: a.hide,
        next: a.next,
        prev: a.prev,
        change: a.change,
        select: a.select,
        value: $.query,
        focus: $.visible,
        small: true,
        icon: Icon.Search,
        desc: 'find in buffer',
      }),

      h(
        'div',
        {
          style: {
            overflow: 'hidden',
          },
        },
        $.results.map((res, pos) =>
          h(
            RowNormal,
            {
              active: pos === $.index,
            },
            res.colorizedLine.map(({ color, text, highlight }) =>
              h(
                'span',
                {
                  style: {
                    fontSize: 'calc(var(--font-size) * 1px)',
                    fontFamily: 'var(--font)',
                    whiteSpace: 'pre',
                    color: color || cvar('foreground'),
                    background: highlight && 'rgba(255, 255, 255, 0.1)',
                  },
                },
                text
              )
            )
          )
        )
      ),
    ]
  )

const containerEl = makel({
  position: 'absolute',
  display: 'flex',
  bottom: 0,
  zIndex: 90, // above cursor + cursorline,
  background: 'var(--background-30)',
  maxHeight: '40%',
  height: '40%',
  width: '100%',
})

const ui = app<S, A>({
  name: 'buffer-search',
  state,
  actions,
  view,
  element: containerEl,
})

api.onAction('buffer-search', ui.show)
api.onAction('buffer-search-resume', () => ui.show(previousSearchCache))
// tip: use 'gn' to turn search selection into visual selection. then use this
api.onAction('buffer-search-visual', async () => {
  // TODO: any cleaner way of doing this?
  await api.nvim.feedkeys('gv"zy')
  const selection = await api.nvim.expr('@z')
  ui.show()
  ui.change(selection)
})
