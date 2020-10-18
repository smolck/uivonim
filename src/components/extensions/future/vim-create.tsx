import { Plugin } from '../../plugin-container'
import { vimBlur, vimFocus } from '../../../ui/uikit'
import { createVim } from '../../../core/instance-manager'
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
const VimCreate = ({ visible, value, inputCallbacks }: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      icon={feather.icons['folder-plus'].toSvg()}
      value={value}
      desc={'create new vim instance'}
      focus={true}
    />
  </Plugin>
)

const container = document.createElement('div')
container.id = 'vim-create-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<VimCreate {...state} />, container)
)

const show = () => (vimBlur(), assignStateAndRender({ visible: true }))

state.inputCallbacks = {
  hide: () => (vimFocus(), assignStateAndRender({ value: '', visible: false })),
  change: (value: string) => assignStateAndRender({ value }),
  select: () => {
    vimFocus()
    state.value && createVim(state.value)
    assignStateAndRender({ value: '', visible: false })
  },
}

api.onAction('vim-create', show)
