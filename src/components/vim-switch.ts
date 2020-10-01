import { list, switchVim } from '../core/instance-manager'
import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'

interface Instance {
  id: number
  name: string
}

const state = {
  value: '',
  visible: false,
  list: [] as Instance[],
  cache: [] as Instance[],
  index: 0,
}

type S = typeof state

const actions = {
  show: (d: Instance[]) => (vimBlur(), { list: d, cache: d, visible: true }),
  hide: () => (vimFocus(), { value: '', visible: false, index: 0 }),
  change: (value: string) => (s: S) => ({
    value,
    index: 0,
    list: value
      ? filter(s.list, value, { key: 'name' }).slice(0, 10)
      : s.cache.slice(0, 10),
  }),

  select: () => (s: S) => {
    vimFocus()
    if (!s.list.length) return { value: '', visible: false, index: 0 }
    const { id } = s.list[s.index]
    if (id) switchVim(id)
    return { value: '', visible: false, index: 0 }
  },

  // TODO: don't limit list to 10 entries and scroll instead!
  next: () => (s: S) => ({
    index: s.index + 1 > Math.min(s.list.length - 1, 9) ? 0 : s.index + 1,
  }),
  prev: () => (s: S) => ({
    index: s.index - 1 < 0 ? Math.min(s.list.length - 1, 9) : s.index - 1,
  }),
}

const view = ($: S, a: typeof actions) =>
  Plugin($.visible, [
    ,
    Input({
      hide: a.hide,
      change: a.change,
      select: a.select,
      next: a.next,
      prev: a.prev,
      value: $.value,
      focus: true,
      icon: Icon.Grid,
      desc: 'switch vim instance',
    }),

    h(
      'div',
      $.list.map(({ id, name }, ix) =>
        h(
          RowNormal,
          {
            key: `${id}-${name}`,
            active: ix === $.index,
          },
          [, h('span', name)]
        )
      )
    ),
  ])

const ui = app({ name: 'vim-switch', state, actions, view })
api.onAction('vim-switch', () => ui.show(list()))
