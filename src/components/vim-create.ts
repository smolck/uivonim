import { Plugin } from '../components/plugin-container'
import { app, vimBlur, vimFocus } from '../ui/uikit'
import { createVim } from '../core/instance-manager'
import Input from '../components/text-input'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'

const state = {
  value: '',
  visible: false,
}

type S = typeof state

const actions = {
  show: () => (vimBlur(), { visible: true }),
  hide: () => (vimFocus(), { value: '', visible: false }),
  change: (value: string) => ({ value }),
  select: () => (s: S) => {
    vimFocus()
    s.value && createVim(s.value)
    return { value: '', visible: false }
  },
}

const view = ($: S, a: typeof actions) =>
  Plugin($.visible, [
    ,
    Input({
      hide: a.hide,
      select: a.select,
      change: a.change,
      value: $.value,
      focus: true,
      icon: Icon.FolderPlus,
      desc: 'create new vim instance',
    }),
  ])

const ui = app({ name: 'vim-create', state, actions, view })
api.onAction('vim-create', ui.show)
