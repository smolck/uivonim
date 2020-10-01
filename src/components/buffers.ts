import FiletypeIcon, { Terminal } from '../components/filetype-icon'
import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import { BufferInfo } from '../neovim/types'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'

const state = {
  value: '',
  buffers: [] as BufferInfo[],
  cache: [] as BufferInfo[],
  visible: false,
  index: 0,
}

type S = typeof state

const resetState = { value: '', visible: false, index: 0 }

const actions = {
  select: () => (s: S) => {
    vimFocus()
    if (!s.buffers.length) return resetState
    const { name } = s.buffers[s.index]
    if (name) api.nvim.cmd(`b ${name}`)
    return resetState
  },

  change: (value: string) => (s: S) => ({
    value,
    index: 0,
    buffers: value
      ? filter(s.cache, value, { key: 'name' }).slice(0, 10)
      : s.cache.slice(0, 10),
  }),

  hide: () => (vimFocus(), resetState),
  show: (buffers: BufferInfo[]) => (
    vimBlur(), { buffers, cache: buffers, visible: true }
  ),
  next: () => (s: S) => ({
    index: s.index + 1 > Math.min(s.buffers.length - 1, 9) ? 0 : s.index + 1,
  }),
  prev: () => (s: S) => ({
    index: s.index - 1 < 0 ? Math.min(s.buffers.length - 1, 9) : s.index - 1,
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
      focus: true,
      icon: Icon.List,
      desc: 'switch buffer',
    }),

    h(
      'div',
      $.buffers.map((f, ix) =>
        h(
          RowNormal,
          {
            active: ix === $.index,
          },
          [
            ,
            f.terminal ? Terminal : FiletypeIcon(f.name),

            h(
              'span',
              {
                render: f.duplicate,
                style: { color: '#666' },
              },
              `${f.dir}/`
            ),

            h('span', f.duplicate ? f.base : f.name),
          ]
        )
      )
    ),
  ])

const ui = app({ name: 'buffers', state, actions, view })
api.onAction('buffers', async () => ui.show(await api.nvim.getBufferInfo()))
