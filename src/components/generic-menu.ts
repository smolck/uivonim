import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import { CreateTask } from '../support/utils'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import { Component } from 'hyperapp'

export interface MenuOption {
  key: any
  value: string
}

interface Props {
  description: string
  options: MenuOption[]
  icon?: Component
}

const state = {
  visible: false,
  value: '',
  options: [] as MenuOption[],
  cache: [] as MenuOption[],
  description: '',
  ix: 0,
  icon: Icon.User,
  task: CreateTask(),
}

type S = typeof state

const resetState = { value: '', visible: false, ix: 0 }

const actions = {
  select: () => (s: S) => {
    vimFocus()
    if (!s.options.length) return resetState
    s.task.done((s.options[s.ix] || {}).key)
    return resetState
  },

  // TODO: not hardcoded 14
  change: (value: string) => (s: S) => ({
    value,
    ix: 0,
    options: value
      ? filter(s.cache, value, { key: 'value' }).slice(0, 14)
      : s.cache.slice(0, 14),
  }),

  show: ({ options, description, icon, task }: any) => (
    vimBlur(),
    {
      description,
      options,
      task,
      icon,
      cache: options,
      visible: true,
    }
  ),

  hide: () => (vimFocus(), resetState),
  next: () => (s: S) => ({
    ix: s.ix + 1 > Math.min(s.options.length - 1, 13) ? 0 : s.ix + 1,
  }),
  prev: () => (s: S) => ({
    ix: s.ix - 1 < 0 ? Math.min(s.options.length - 1, 13) : s.ix - 1,
  }),
}

const view = ($: S, a: typeof actions) =>
  Plugin($.visible, [
    ,
    Input({
      select: a.select,
      change: a.change,
      hide: a.hide,
      next: a.next,
      prev: a.prev,
      value: $.value,
      desc: $.description,
      focus: true,
      icon: $.icon,
    }),

    h(
      'div',
      $.options.map(({ key, value }, id) =>
        h(
          RowNormal,
          {
            key,
            active: id === $.ix,
          },
          [, h('span', value)]
        )
      )
    ),
  ])

const ui = app({ name: 'generic-menu', state, actions, view })

export default <T>(props: Props) => {
  const task = CreateTask<T>()
  ui.show({ ...props, task })
  return task.promise
}
