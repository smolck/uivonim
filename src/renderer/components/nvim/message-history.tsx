import { MessageKind, Message } from '../../../common/types'
import { RowDesc } from '../row-container'
import { vimBlur, vimFocus } from '../../ui/uikit'
import Input from '../text-input'
import { filter } from 'fuzzaldrin-plus'
import Icon from '../icon'
import { colors } from '../../ui/styles'
import { render } from 'inferno'

let state = {
  query: '',
  messages: [] as Message[],
  cache: [] as Message[],
  vis: false,
  ix: 0,
  inputCallbacks: {},
}

type S = typeof state

let elref: HTMLElement
const SCROLL_AMOUNT = 0.4

const iconStyle = { fontSize: '1.2rem' }

// TODO(smolck): equivalent to h(Icon.*, { color: colors.*, style: iconStyle })?
const createIcon = (name: string, color: string) => ({
  icon: <Icon icon={name} style={{ ...iconStyle, color }} />,
  color: color,
})

const icons = new Map([
  [MessageKind.Error, createIcon('x-circle', colors.error)],
  [MessageKind.Warning, createIcon('alert-triangle', colors.warning)],
  [MessageKind.Success, createIcon('check-circle', colors.success)],
  [MessageKind.Info, createIcon('message-circle', colors.info)],
  [MessageKind.Hidden, createIcon('message-circle', colors.info)],
  [MessageKind.System, createIcon('alert-circle', colors.system)],
])

const getIcon = (kind: MessageKind) =>
  icons.get(kind) || icons.get(MessageKind.Info)

const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

const MessageHistory = ({
  vis: visible,
  messages,
  ix: index,
  inputCallbacks,
  query,
}: S) => (
  <div
    style={{
      background: 'var(--background-45)',
      color: '#eee',
      display: visible ? 'flex' : 'none',
      position: 'absolute',
      width: '100%',
      'flex-flow': 'column',
      'align-self': 'flex-end',
      'max-height': '85vh',
    }}
  >
    <Input
      id={'message-history-input'}
      {...inputCallbacks}
      icon={'filter'}
      value={query}
      desc={'filter messages'}
      focus={true}
      small={true}
    />

    <WhyDiv
      onComponentDidMount={(e: HTMLElement) => (elref = e)}
      style={{ overflow: 'hidden' }}
    >
      {messages.map(({ kind, message }, pos) => (
        <RowDesc active={pos === index}>
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              'padding-right': '10px',
            }}
          >
            {getIcon(kind)?.icon}
          </div>

          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              color: (icons.get(kind) || icons.get(MessageKind.Info))!.color,
            }}
          >
            {message}
          </div>
        </RowDesc>
      ))}
    </WhyDiv>
  </div>
)

const container = document.createElement('div')
container.id = 'message-history-container'
document.getElementById('plugins')?.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState),
  render(<MessageHistory {...state} />, container)
)

const show = (messages: Message[]) => (
  vimBlur(), assignStateAndRender({ messages, cache: messages, vis: true })
)

const hide = () => (
  vimFocus(), assignStateAndRender({ vis: false, query: '', ix: 0 })
)

const next = () =>
  assignStateAndRender({
    ix: state.ix + 1 >= state.messages.length ? 0 : state.ix + 1,
  })

const prev = () =>
  assignStateAndRender({
    ix: state.ix - 1 < 0 ? state.messages.length - 1 : state.ix - 1,
  })

const down = () => {
  const { height } = elref.getBoundingClientRect()
  elref.scrollTop += Math.floor(height * SCROLL_AMOUNT)
}

const up = () => {
  const { height } = elref.getBoundingClientRect()
  elref.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
}

const change = (query: string) =>
  assignStateAndRender({
    query,
    ix: 0,
    messages: query
      ? filter(state.messages, query, { key: 'message' })
      : state.cache,
  })

state.inputCallbacks = {
  hide,
  next,
  prev,
  down,
  up,
  change,
}

export const showMessageHistory = (messages: Message[]) => show(messages)
