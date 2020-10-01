import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { InventoryAction } from '../inventory/actions'
import inventoryActions from '../inventory/actions'
import { registerShortcut } from '../core/input'
import Input from '../components/text-input'
import { VimMode } from '../neovim/types'
import * as Icon from 'hyperapp-feather'
import { filter } from 'fuzzaldrin-plus'
import api from '../core/instance-api'
import { h, app } from '../ui/uikit'

const state = {
  index: 0,
  visible: false,
  value: '',
  actions: [] as InventoryAction[],
  cache: [] as InventoryAction[],
}

type S = typeof state

const resetState = { visible: false, actions: [], cache: [] }

const actions = {
  select: () => (s: S) => {
    if (!s.actions.length) return resetState
    const action = s.actions[s.index]
    console.warn('NYI: select action', action)
    return resetState
  },
  change: (value: string) => (s: S) => ({
    value,
    index: 0,
    actions: value
      ? filter(s.cache, value, { key: 'name' }).slice(0, 10)
      : s.cache.slice(0, 10),
  }),
  show: (actions: InventoryAction[]) => ({
    actions: actions.slice(0, 10),
    cache: actions.slice(0, 10),
    visible: true,
  }),
  hide: () => resetState,
  next: () => (s: S) => ({ index: s.index + 1 > 9 ? 0 : s.index + 1 }),
  prev: () => (s: S) => ({ index: s.index - 1 < 0 ? 9 : s.index - 1 }),
}

type A = typeof actions

const view = ($: S, a: A) =>
  Plugin($.visible, [
    ,
    Input({
      select: a.select,
      change: a.change,
      hide: a.hide,
      next: a.next,
      prev: a.prev,
      value: $.value,
      focus: true,
      icon: Icon.Compass,
      desc: 'inventory',
    }),

    h(
      'div',
      $.actions.map((action, ix) =>
        h(
          RowNormal,
          {
            active: ix === $.index,
          },
          [
            ,
            h('div', action.name),
            h('div', action.layer),
            h('div', action.description),
            h('div', action.experimental),
            h('div', action.keybind),
          ]
        )
      )
    ),
  ])

const ui = app<S, A>({ name: 'inventory-search', state, actions, view })

// TODO: inventory actions never change, so we should have no need
// to compute these dynamically on every call. the only reason we
// currently do that is because we put all 'nvim.registerAction'
// calls inside each module which most often get 'require' async.
// we should move out the register layer actions to be static
// and only setup this view with the actions ONCE.
const doInventorySearch = () => {
  const actions = inventoryActions.list()
  ui.show(actions)
}

api.onAction('inventory-search', doInventorySearch)
registerShortcut('s-c-p', VimMode.Normal, doInventorySearch)
