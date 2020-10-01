import {
  hideCursor,
  showCursor,
  disableCursor,
  enableCursor,
} from '../core/cursor'
import { CommandType, CommandUpdate } from '../render/events'
import * as windows from '../windows/window-manager'
import { WindowOverlay } from '../windows/window'
import Input from '../components/text-input'
import { sub } from '../messaging/dispatch'
import { rgba, paddingV } from '../ui/css'
import * as Icon from 'hyperapp-feather'
import { is } from '../support/utils'
import { makel } from '../ui/vanilla'
import { app, h } from '../ui/uikit'

const state = {
  visible: false,
  value: '',
  position: 0,
  kind: CommandType.Ex,
}

type S = typeof state
let winOverlay: WindowOverlay

const actions = {
  hide: () => {
    enableCursor()
    showCursor()
    if (winOverlay) winOverlay.remove()
    return { value: '', visible: false }
  },
  updateQuery: ({ cmd, kind, position }: CommandUpdate) => (s: S) => {
    const cmdKind = kind || s.kind
    hideCursor()
    disableCursor()

    !s.visible &&
      setImmediate(() => {
        winOverlay = windows.getActive().addOverlayElement(containerEl)
      })

    return {
      position,
      kind: cmdKind,
      visible: true,
      value: is.string(cmd) && s.value !== cmd ? cmd : s.value,
    }
  },
}

type A = typeof actions

const printCommandType = (kind: CommandType) => {
  if (kind === CommandType.SearchForward) return 'forward search'
  if (kind === CommandType.SearchBackward) return 'backward search'
  // should never happen
  else return 'search'
}

const view = ($: S, a: A) =>
  h(
    'div',
    {
      style: {
        display: $.visible ? 'flex' : 'none',
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
        [, h('span', printCommandType($.kind))]
      ),

      Input({
        small: true,
        focus: $.visible,
        desc: 'search query',
        value: $.value,
        icon: Icon.Search,
        position: $.position,
        hide: a.hide,
        select: a.hide,
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
  name: 'vim-search',
  state,
  actions,
  view,
  element: containerEl,
})

sub('search.hide', ui.hide)
sub('search.update', ui.updateQuery)
