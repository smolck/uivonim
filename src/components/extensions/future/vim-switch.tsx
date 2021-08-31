import { list, switchVim } from '../../../core/instance-manager'
import { Plugin } from '../../plugin-container'
import { RowNormal } from '../../row-container'
import { vimBlur, vimFocus } from '../../../ui/uikit'
import Input from '../../text-input'
import { filter } from 'fuzzaldrin-plus'
import api from '../../../core/instance-api'
import { render } from 'inferno'

interface Instance {
  id: number
  name: string
}

let state = {
  value: '',
  visible: false,
  list: [] as Instance[],
  cache: [] as Instance[],
  index: 0,
  inputCallbacks: {},
}

type S = typeof state

const feather = require('feather-icons')
const VimSwitch = ({ visible, value, index, inputCallbacks, list }: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'vim-switch-input'}
      value={value}
      focus={true}
      icon={feather.icons['grid'].toSvg()}
      desc={'switch vim instance'}
    />

    <div>
      {list.map(({ id, name }, ix) => (
        <RowNormal active={ix === index} key={`${id}-${name}`}>
          <span>{name}</span>
        </RowNormal>
      ))}
    </div>
  </Plugin>
)

const container = document.createElement('div')
container.id = 'vim-rename-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<VimSwitch {...state} />, container)
)

const show = (d: Instance[]) => (
  vimBlur(), assignStateAndRender({ list: d, cache: d, visible: true })
)

state.inputCallbacks = {
  hide: () => (
    vimFocus(), assignStateAndRender({ value: '', visible: false, index: 0 })
  ),
  change: (value: string) =>
    assignStateAndRender({
      value,
      index: 0,
      list: value
        ? filter(state.list, value, { key: 'name' }).slice(0, 10)
        : state.cache.slice(0, 10),
    }),

  select: () => {
    vimFocus()
    if (!state.list.length) {
      assignStateAndRender({ value: '', visible: false, index: 0 })
      return
    }
    const { id } = state.list[state.index]
    if (id) switchVim(id)
    assignStateAndRender({ value: '', visible: false, index: 0 })
  },

  // TODO: don't limit list to 10 entries and scroll instead!
  next: () =>
    assignStateAndRender({
      index:
        state.index + 1 > Math.min(state.list.length - 1, 9)
          ? 0
          : state.index + 1,
    }),
  prev: () =>
    assignStateAndRender({
      index:
        state.index - 1 < 0
          ? Math.min(state.list.length - 1, 9)
          : state.index - 1,
    }),
}

api.onAction('vim-switch', () => show(list()))
