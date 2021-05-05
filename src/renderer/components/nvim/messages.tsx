import {
  MessageKind,
  Message,
  MessageReturn,
  MessageStatusUpdate,
} from '../../../common/types'
import { uuid, CreateTask, arrReplace } from '../../../common/utils'
import { colors } from '../../ui/styles'
import { cvar } from '../../ui/css'
import { render } from 'inferno'
import Icon from '../icon'
import { Invokables } from '../../../common/ipc'

interface MessageAction {
  label: string
  shortcut: string
  shortcutLabel: string
}

interface IMessage {
  id: string
  kind: MessageKind
  message: string
  actions: MessageAction[]
  onAction: (action: string) => void
  stealsFocus: boolean
  progress?: number
  progressStatus?: string
}

interface IMessageStatusUpdate extends MessageStatusUpdate {
  id: string
}

let state = {
  messages: [] as IMessage[],
}

type S = typeof state

// TODO(smolck): No need for this?
const createIcon = (name: string) => <Icon icon={name} />
const renderIcons = new Map([
  [MessageKind.Error, createIcon('x-circle')],
  [MessageKind.Warning, createIcon('alert-triangle')],
  [MessageKind.Success, createIcon('check-circle')],
  [MessageKind.Info, createIcon('message-circle')],
  [MessageKind.System, createIcon('alert-circle')],
  [MessageKind.Progress, createIcon('clock')],
])

const getIcon = (kind: MessageKind) => renderIcons.get(kind)!

type ActionParams = {
  label: string
  shortcut: string
}
const Action = ({ label, shortcut }: ActionParams) => (
  <div style={{ 'margin-left': '10px' }}>
    <div style={{ display: 'flex' }}>
      <div
        style={{
          padding: '5px 10px',
          display: 'flex',
          background: highlightColor,
          color: cvar('foreground'),
          border: 'none',
          'border-radius': '2px',
          'border-top-right-radius': 0,
          'border-bottom-right-radius': 0,
          'justify-content': 'center',
          'align-items': 'center',
          'clip-path': 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
          'padding-right': '20px',
          'margin-right': '-12px',
          'font-size': '1rem',
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: cvar('foreground-20'),
          background: 'none',
          padding: '5px 10px',
          border: '1px solid',
          display: 'flex',
          'clip-path': 'polygon(12px 0, 100% 0, 100% 100%, 0 100%)',
          'border-radius': '2px',
          'border-top-left-radius': 0,
          'border-bottom-left-radius': 0,
          'border-color': highlightColor,
          'border-left': 'none',
          'align-items': 'center',
          'justify-content': 'center',
          'font-size': '0.86rem',
          'font-weight': 'bold',
          'padding-left': '20px',
        }}
      >
        {shortcut}
      </div>
    </div>
  </div>
)

const MessageView = ({
  progressStatus,
  actions,
  progress,
  message,
  kind,
  isLast,
}: IMessage & { isLast: boolean }) => (
  <div
    style={{
      display: 'flex',
      padding: '16px 18px',
      background: cvar('background-30'),
      'margin-top': '4px',
      'border-left': '4px solid',
      'border-color': Reflect.get(colors, kind),
      'font-size': '1.2rem',
    }}
  >
    <div>{getIcon(kind)}</div>

    <div
      style={{
        display: 'flex',
        width: '100%',
        'flex-flow': 'column',
      }}
    >
      <div style={{ color: cvar('foreground-10') }}>
        {message.split('\n').map((line) => (
          <div>{line}</div>
        ))}
      </div>

      {kind === MessageKind.Progress && (
        <div style={{ 'margin-top': '20px', display: 'flex' }}>
          <div
            style={{
              height: '5px',
              background: highlightColorBrighter,
              filter: 'brighten(90%)',
              width: `${progress || 1}%`,
              transition: 'width 0.5s',
              'border-radius': '2px',
            }}
          />
        </div>
      )}

      {progressStatus && (
        <div
          style={{
            display: 'flex',
            'margin-top': '6px',
            'font-size': '0.9rem',
          }}
        >
          <div style={{ color: 'var(--foreground-40)' }}>{progressStatus}</div>
        </div>
      )}

      {isLast &&
        // TODO(smolck): Why the double exclamation mark?
        !!actions.length && (
          <div
            style={{
              display: 'flex',
              'margin-top': '12px',
              'justify-content': 'flex-end',
            }}
          >
            {actions.map((a) => (
              <Action label={a.label} shortcut={a.shortcutLabel} />
            ))}
          </div>
        )}
    </div>
  </div>
)

// TODO: create a highlight color from vim colorscheme
// const highlightColor = 'rgb(87, 52, 121)'
const highlightColor = 'rgb(78, 56, 100)'
const highlightColorBrighter = 'rgb(129, 84, 174)'

const Messages = ({ messages }: S) => (
  <div
    style={{
      display: 'flex',
      height: '100%',
      width: '100%',
      'align-items': 'flex-end',
      'justify-content': 'flex-end',
    }}
  >
    <div
      style={{
        display: 'flex',
        'flex-flow': 'column',
        'max-width': '500px',
        'min-width': '350px',
      }}
    >
      {void registerFirstMessageShortcuts(messages[messages.length - 1])}
      {messages.map((m, ix) => (
        <MessageView {...m} isLast={ix === messages.length - 1} />
      ))}
    </div>
  </div>
)

// will there be more than 6 message actions?
const availableShortcuts = [
  { shortcutLabel: 'C S Y', shortcut: '<C-S-Y>' },
  { shortcutLabel: 'C S T', shortcut: '<C-S-T>' },
  { shortcutLabel: 'C S U', shortcut: '<C-S-U>' },
  { shortcutLabel: 'C S R', shortcut: '<C-S-R>' },
  { shortcutLabel: 'C S E', shortcut: '<C-S-E>' },
  { shortcutLabel: 'C S W', shortcut: '<C-S-W>' },
]

const getShortcut = (index: number) =>
  availableShortcuts[index] || {
    shortcutLabel: '???',
    shortcut: '',
  }

const registerFirstMessageShortcuts = (message: IMessage) => {
  if (!message || message.stealsFocus) return

  const shortcuts = message.actions.map((m) => m.shortcut)

  window.api
    .invoke(Invokables.registerOneTimeUseShortcuts, shortcuts)
    .then((shortcut) => {
      const action = message.actions.find((m) => m.shortcut === shortcut)
      if (action) message.onAction(action.label)
    })
}

// generic close/dismiss message functionality - like the (x) button in the prompt
const addDefaultDismissAction = (msg: IMessage | Message) =>
  !msg.stealsFocus
    ? [
        {
          label: 'Dismiss',
          shortcutLabel: 'C S N',
          shortcut: '<C-S-N>',
        },
      ]
    : []

const container = document.createElement('div')
container.id = 'messages-container'
document.getElementById('plugins')!.appendChild(container)
const assignStateAndRender = (newState: S) => (
  Object.assign(state, newState), render(<Messages {...state} />, container)
)

const uiShowMessage = (message: IMessage) =>
  assignStateAndRender({ messages: [message, ...state.messages] })

const setMessageProgress = ({
  id,
  percentage,
  status,
}: IMessageStatusUpdate) => {
  const messages = arrReplace(state.messages, (m) => m.id, {
    progress: percentage,
    progressStatus: status,
  })

  if (!messages)
    return console.error(
      `can not update message progress because it does not exist ${id}`
    )
  assignStateAndRender({ messages })
}

const appendMessage = (message: IMessage) => {
  const [firstMessage, ...nextMessages] = state.messages
  const firstNvimMessage = firstMessage ? firstMessage : null
  if (!firstNvimMessage) {
    message.actions = addDefaultDismissAction(message)
    assignStateAndRender({ messages: [message, ...state.messages] })
    return
  }

  firstMessage.message += message.message
  assignStateAndRender({ messages: [firstMessage, ...nextMessages] })
}

const removeMessage = (id: string) =>
  assignStateAndRender({
    messages: state.messages.filter((m) => m.id !== id),
  })

const clearMessages = (clearFn?: (message: IMessage) => boolean) =>
  assignStateAndRender({
    messages: clearFn ? state.messages.filter((m) => clearFn(m)) : [],
  })

const showMessage = (message: Message): MessageReturn => {
  const id = uuid()
  const task = CreateTask<string>()

  const registeredActions = message.actions || []
  if (registeredActions.length > 6)
    console.error('messages: more than 6 actions - not enough shortcuts!')
  const definedActions = registeredActions.map((label, ix) => ({
    ...getShortcut(ix),
    label,
  }))
  const actions = [...definedActions, ...addDefaultDismissAction(message)]

  if (message.progressCancellable)
    actions.push({
      label: 'Cancel',
      shortcutLabel: 'C S C',
      shortcut: '<C-S-C>',
    })

  const callback = (action: string) => {
    removeMessage(id)
    task.done(action)
  }

  uiShowMessage({
    ...message,
    id,
    actions,
    onAction: callback,
    progress: message.progress || 1,
    stealsFocus: message.stealsFocus || false,
  })

  const setProgress = (update: MessageStatusUpdate) =>
    setMessageProgress({ ...update, id })
  const remove = () => removeMessage(id)

  return { remove, setProgress, promise: task.promise }
}

export default {
  show: (message: Message) => showMessage(message),
  append: (message: Message) => {
    const id = uuid()
    appendMessage({
      ...message,
      id,
      actions: [],
      onAction: () => removeMessage(id),
      stealsFocus: message.stealsFocus || false,
    })
  },
  clear: (matcher?: (message: IMessage) => boolean) => {
    clearMessages(matcher)
  },
}
