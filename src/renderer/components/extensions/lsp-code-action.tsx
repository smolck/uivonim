import { RowNormal } from '../row-container'
import { vimBlur, vimFocus } from '../../ui/uikit'
import * as windows from '../../windows/window-manager'
import Input from '../text-input'
import Overlay from '../overlay'
import { filter } from 'fuzzaldrin-plus'
import { render } from 'inferno'
import api from '../../core/instance-api'
import { cursor } from '../../core/cursor'

type CodeAction = {
  title: string
  kind?: string
  isPreferred?: boolean
  edit?: any
  command?: any
  arguments: any
}

let state = {
  x: 0,
  y: 0,
  value: '',
  visible: false,
  actions: [] as CodeAction[],
  cache: [] as CodeAction[],
  index: 0,
}

type S = typeof state

const resetState = { value: '', visible: false }

const plugins = document.getElementById('plugins')
const container = document.createElement('div')
container.id = 'code-action-container'
plugins?.appendChild(container)

const CodeAction = ({ x, y, visible, value, actions, index }: S) => (
  <Overlay
    x={x}
    y={y}
    zIndex={100}
    maxWidth={600}
    visible={visible}
    anchorAbove={false}
  >
    <div style={{ background: 'var(--background-40)' }}>
      <Input
        id={'code-action-input'}
        hide={hide}
        next={next}
        prev={prev}
        change={change}
        select={select}
        value={value}
        focus={true}
        small={true}
        icon={'code'}
        desc={'run code action'}
      />
      {actions.map((s, ix) => (
        <RowNormal key={s.title} active={ix === index}>
          <span>{s.title}</span>
        </RowNormal>
      ))}
    </div>
  </Overlay>
)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<CodeAction {...state} />, container)
)

const show = ({ x, y, actions }: any) => {
  vimBlur()
  assignStateAndRender({ x, y, actions, cache: actions, visible: true })
}

const hide = () => {
  vimFocus()
  assignStateAndRender(resetState)
}

const change = (value: string) =>
  assignStateAndRender({
    value,
    index: 0,
    actions: value
      ? filter(state.actions, value, { key: 'title' })
      : state.cache,
  })

const select = () => {
  vimFocus()
  if (!state.actions.length) return resetState
  const action = state.actions[state.index]
  if (action)
    // @ts-ignore <- without this get an error about luaeval not being a
    // property

    // roundtrip through vimscript since TS dict looks like a vimscript dict
    // TODO: see if action can be converted to a Lua table to allow direct call to lua
    api.nvim.call.luaeval(
      "require'uivonim/lsp'.handle_chosen_code_action(_A)",
      action
    )
  assignStateAndRender(resetState)
}

const next = () =>
  assignStateAndRender({
    index: state.index + 1 > state.actions.length - 1 ? 0 : state.index + 1,
  })

const prev = () =>
  assignStateAndRender({
    index: state.index - 1 < 0 ? state.actions.length - 1 : state.index - 1,
  })

api.onAction('code-action', (actions) => {
  const { x, y } = windows.pixelPosition(cursor.row + 1, cursor.col)
  show({
    x,
    y,
    actions: actions.map((x: any) => ({
      title: x.title,
      kind: x.kind,
      edit: x.edit,
      command: x.command,
      arguments: x.arguments,
    })),
  })
})
