import { renameCurrent, getCurrentName } from '../../../core/instance-manager'
import { Plugin } from '../../plugin-container'
import { vimBlur, vimFocus } from '../../../ui/uikit'
import Input from '../../text-input'
import api from '../../../core/instance-api'
import { render } from 'inferno'

let state = {
  value: '',
  visible: false,
  inputCallbacks: {},
}

type S = typeof state

const feather = require('feather-icons')
const VimRename = ({ visible, value, inputCallbacks }: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'vim-rename-input'}
      focus={true}
      icon={feather.icons['edit'].toSvg()}
      value={value}
      desc={'rename vim instance'}
    />
  </Plugin>
)

const container = document.createElement('div')
container.id = 'vim-rename-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<VimRename {...state} />, container)
)

const show = (value: string) => (
  vimBlur(), assignStateAndRender({ value, visible: true })
)

state.inputCallbacks = {
  hide: () => (vimFocus(), assignStateAndRender({ value: '', visible: false })),
  change: (value: string) => assignStateAndRender({ value }),
  select: () => {
    vimFocus()
    state.value && renameCurrent(state.value)
    assignStateAndRender({ value: '', visible: false })
  },
}

api.onAction('vim-rename', () => show(getCurrentName()))
