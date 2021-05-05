import { Plugin } from '../../plugin-container'
import { RowNormal } from '../../row-container'
import { vimBlur, vimFocus } from '../../../ui/uikit'
import { CreateTask } from '../../../support/utils'
import Input from '../../text-input'
import { filter } from 'fuzzaldrin-plus'
import { render } from 'inferno'

export interface MenuOption {
  key: any
  value: string
}

interface Props {
  description: string
  options: MenuOption[]
  icon?: Component
}

let state = {
  visible: false,
  value: '',
  options: [] as MenuOption[],
  cache: [] as MenuOption[],
  description: '',
  ix: 0,
  task: CreateTask(),
  inputCallbacks: {},
}

type S = typeof state

const resetState = { value: '', visible: false, ix: 0 }

const feather = require('feather-icons')
const GenericMenu = ({
  visible,
  inputCallbacks,
  value,
  description,
  options,
  ix: index,
}: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'generic-menu-input'}
      value={value}
      desc={description}
      icon={feather.icons['user'].toSvg()}
      focus={true}
    />

    <div>
      {options.map(({ key, value }, id) => (
        <RowNormal key={key} active={id === index}>
          <span>{value}</span>
        </RowNormal>
      ))}
    </div>
  </Plugin>
)

const container = document.createElement('div')
container.id = 'generic-menu-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<GenericMenu {...state} />, container)
)

const show = ({ options, description, icon, task }: any) => (
  vimBlur(),
  assignStateAndRender({
    description,
    options,
    task,
    icon,
    cache: options,
    visible: true,
  })
)

state.inputCallbacks = {
  select: () => {
    vimFocus()
    if (!state.options.length) return resetState
    state.task.done((state.options[state.ix] || {}).key)
    return resetState
  },

  // TODO: not hardcoded 14
  change: (value: string) =>
    assignStateAndRender({
      value,
      ix: 0,
      options: value
        ? filter(state.cache, value, { key: 'value' }).slice(0, 14)
        : state.cache.slice(0, 14),
    }),
  hide: () => (vimFocus(), assignStateAndRender(resetState)),
  next: () =>
    assignStateAndRender({
      ix:
        state.ix + 1 > Math.min(state.options.length - 1, 13)
          ? 0
          : state.ix + 1,
    }),
  prev: () =>
    assignStateAndRender({
      ix:
        state.ix - 1 < 0
          ? Math.min(state.options.length - 1, 13)
          : state.ix - 1,
    }),
}

export default function <T>(props: Props) {
  const task = CreateTask<T>()
  show({ ...props, task })
  return task.promise
}
