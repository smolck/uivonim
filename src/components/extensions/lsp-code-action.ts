import { RowNormal } from '../row-container'
import { h, app, vimBlur, vimFocus } from '../../ui/uikit'
import * as windows from '../../windows/window-manager'
import Input from '../text-input'
import Overlay from '../overlay'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../../core/instance-api'
import { cursor } from '../../core/cursor'

type CodeAction = {
  title: string
  kind?: string
  isPreferred?: boolean
  edit?: any
  command?: any
  arguments: any
}

const state = {
  x: 0,
  y: 0,
  value: '',
  visible: false,
  actions: [] as CodeAction[],
  cache: [] as CodeAction[],
  index: 0,
}

type S = typeof state

const resetState = { value: '', visible: false }

const actions = {
  show: ({ x, y, actions }: any) => {
    vimBlur()
    return { x, y, actions, cache: actions, visible: true }
  },
  hide: () => (vimFocus(), resetState),

  change: (value: string) => (s: S) => ({
    value,
    index: 0,
    actions: value ? filter(s.actions, value, { key: 'title' }) : s.cache,
  }),

  select: () => (s: S) => {
    vimFocus()
    if (!s.actions.length) return resetState
    const action = s.actions[s.index]
    if (action)
      // @ts-ignore <- without this get an error about luaeval not being a
      // property

      // roundtrip through vimscript since TS dict looks like a vimscript dict
      // TODO: see if action can be converted to a Lua table to allow direct call to lua
      api.nvim.call.luaeval(
        "require'uivonim/lsp'.handle_chosen_code_action(_A)",
        action
      )
    return resetState
  },

  next: () => (s: S) => ({
    index: s.index + 1 > s.actions.length - 1 ? 0 : s.index + 1,
  }),
  prev: () => (s: S) => ({
    index: s.index - 1 < 0 ? s.actions.length - 1 : s.index - 1,
  }),
}

const view = ($: S, a: typeof actions) =>
  Overlay(
    {
      x: $.x,
      y: $.y,
      zIndex: 100,
      maxWidth: 600,
      visible: $.visible,
      anchorAbove: false,
    },
    [
      ,
      h(
        'div',
        {
          style: {
            background: 'var(--background-40)',
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
            value: $.value,
            focus: true,
            small: true,
            icon: Icon.Code,
            desc: 'run code action',
          }),

          h(
            'div',
            $.actions.map((s, ix) =>
              h(
                RowNormal,
                {
                  key: s.title,
                  active: ix === $.index,
                },
                [, h('span', s.title)]
              )
            )
          ),
        ]
      ),
    ]
  )

const ui = app({ name: 'code-actions', state, actions, view })

api.onAction('code-action', (actions) => {
  const { x, y } = windows.pixelPosition(cursor.row + 1, cursor.col)
  ui.show({
    x,
    y,
    actions: actions.map((x) => ({
      title: x.title,
      kind: x.kind,
      edit: x.edit,
      command: x.command,
      arguments: x.arguments,
    })),
  })
})
