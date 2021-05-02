import FiletypeIcon, { Terminal } from '../filetype-icon'
import { Plugin } from '../plugin-container'
import { RowNormal } from '../row-container'
import { vimBlur, vimFocus } from '../../ui/uikit'
import { BufferInfo } from '../../../common/types'
import Input from '../text-input'
import { filter } from 'fuzzaldrin-plus'
import { render } from 'inferno'
import { Events, Invokables } from '../../../common/ipc'

let state = {
  value: '',
  buffers: [] as BufferInfo[],
  cache: [] as BufferInfo[],
  visible: false,
  index: 0,
  inputCallbacks: {},
}

type S = typeof state

const resetState = { value: '', visible: false, index: 0 }

const Buffers = ({ visible, value, index, buffers, inputCallbacks }: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'buffers-input'}
      focus={true}
      value={value}
      icon={'list'}
      desc={'switch buffer'}
    />

    <div>
      {buffers.map((f, ix) => (
        <RowNormal active={ix === index}>
          {f.terminal ? Terminal : FiletypeIcon(f.name)}
          <span
            style={{
              color: '#666',
              // TODO(smolck): Equivalent to
              // h('span', { render: f.duplicate }, ...) with hyperapp?
              display: f.duplicate ? 'block' : undefined,
            }}
          >
            {f.dir}/
          </span>
          <span>{f.duplicate ? f.base : f.name}</span>
        </RowNormal>
      ))}
    </div>
  </Plugin>
)

const container = document.createElement('div')
container.id = 'buffers-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<Buffers {...state} />, container)
)

const select = () => {
  vimFocus()
  if (!state.buffers.length) {
    assignStateAndRender(resetState)
    return
  }

  const { name } = state.buffers[state.index]
  if (name) window.api.invoke(Invokables.nvimCmd, `b ${name}`)
  assignStateAndRender(resetState)
}

const change = (value: string) =>
  assignStateAndRender({
    value,
    index: 0,
    buffers: value
      ? filter(state.cache, value, { key: 'name' }).slice(0, 10)
      : state.cache.slice(0, 10),
  })

const hide = () => (vimFocus(), assignStateAndRender(resetState))

const next = () =>
  assignStateAndRender({
    index:
      state.index + 1 > Math.min(state.buffers.length - 1, 9)
        ? 0
        : state.index + 1,
  })

const prev = () =>
  assignStateAndRender({
    index:
      state.index - 1 < 0
        ? Math.min(state.buffers.length - 1, 9)
        : state.index - 1,
  })

state.inputCallbacks = {
  select,
  change,
  hide,
  next,
  prev,
}

const show = (buffers: BufferInfo[]) => (
  vimBlur(), assignStateAndRender({ buffers, cache: buffers, visible: true })
)

window.api.on(Events.buffersAction, async () => show(await window.api.invoke(Invokables.getBufferInfo)))
