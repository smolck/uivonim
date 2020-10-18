import { Plugin } from '../../plugin-container'
import { vimBlur, vimFocus } from '../../../ui/uikit'
import { CreateTask } from '../../../support/utils'
import Input from '../../text-input'
import { render } from 'inferno'

let state = {
  value: '',
  desc: '',
  visible: false,
  task: CreateTask(),
  inputCallbacks: {},
}

type S = typeof state

const resetState = { value: '', visible: false, desc: '' }

const feather = require('feather-icons')
const GenericPrompt = ({ visible, value, desc, inputCallbacks }: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'generic-prompt-input'}
      focus={true}
      icon={feather.icons['help-circle'].toSvg()}
      value={value}
      desc={desc}
    />
  </Plugin>
)

const container = document.createElement('div')
container.id = 'generic-prompt-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState),
  render(<GenericPrompt {...state} />, container)
)

const show = ({ desc, task }: any) => (
  vimBlur(),
  assignStateAndRender({
    desc,
    task,
    value: '',
    visible: true,
  })
)

state.inputCallbacks = {
  hide: () => (vimFocus(), assignStateAndRender(resetState)),
  change: (value: string) => assignStateAndRender({ value }),
  select: () => {
    state.value && state.task.done(state.value)
    vimFocus()
    assignStateAndRender(resetState)
  },
}

export default (question: string) => {
  const task = CreateTask<string>()
  show({ task, desc: question })
  return task.promise
}
