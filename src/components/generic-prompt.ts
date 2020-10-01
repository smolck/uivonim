import { Plugin } from '../components/plugin-container'
import { app, vimBlur, vimFocus } from '../ui/uikit'
import { CreateTask } from '../support/utils'
import Input from '../components/text-input'
import * as Icon from 'hyperapp-feather'

const state = {
  value: '',
  desc: '',
  visible: false,
  task: CreateTask(),
}

type S = typeof state

const resetState = { value: '', visible: false, desc: '' }

const actions = {
  show: ({ desc, task }: any) => (
    vimBlur(),
    {
      desc,
      task,
      value: '',
      visible: true,
    }
  ),
  hide: () => (vimFocus(), resetState),
  change: (value: string) => ({ value }),
  select: () => (s: S) => {
    s.value && s.task.done(s.value)
    vimFocus()
    return resetState
  },
}

type A = typeof actions

const view = ($: S, a: A) =>
  Plugin($.visible, [
    ,
    Input({
      focus: true,
      icon: Icon.HelpCircle,
      hide: a.hide,
      select: a.select,
      change: a.change,
      value: $.value,
      desc: $.desc,
    }),
  ])

const ui = app<S, A>({ name: 'generic-prompt', state, actions, view })

export default (question: string) => {
  const task = CreateTask<string>()
  ui.show({ task, desc: question })
  return task.promise
}
