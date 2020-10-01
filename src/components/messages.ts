import {
  MessageKind,
  Message,
  MessageReturn,
  MessageStatusUpdate,
} from '../protocols/veonim'
import { uuid, CreateTask, arrReplace } from '../support/utils'
import { registerOneTimeUseShortcuts } from '../core/input'
import * as Icon from 'hyperapp-feather'
import { colors } from '../ui/styles'
import { h, app } from '../ui/uikit'
import { cvar } from '../ui/css'
export { MessageKind } from '../protocols/veonim'

enum MessageSource {
  Neovim,
  VSCode,
}

interface MessageAction {
  label: string
  shortcut: string
  shortcutLabel: string
}

interface IMessage {
  id: string
  source: MessageSource
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

const state = {
  messages: [] as IMessage[],
}

type S = typeof state

const renderIcons = new Map([
  [MessageKind.Error, Icon.XCircle],
  [MessageKind.Warning, Icon.AlertTriangle],
  [MessageKind.Success, Icon.CheckCircle],
  [MessageKind.Info, Icon.MessageCircle],
  [MessageKind.System, Icon.AlertCircle],
  [MessageKind.Progress, Icon.Clock],
])

const getIcon = (kind: MessageKind) => renderIcons.get(kind)!

const actions = {
  showMessage: (message: IMessage) => (s: S) => ({
    messages: [message, ...s.messages],
  }),
  setMessageProgress: ({ id, percentage, status }: IMessageStatusUpdate) => (
    s: S
  ) => {
    const messages = arrReplace(s.messages, (m) => m.id, {
      progress: percentage,
      progressStatus: status,
    })

    if (!messages)
      return console.error(
        `can not update message progress because it does not exist ${id}`
      )
    return { messages }
  },
  appendMessage: (message: IMessage) => (s: S) => {
    const [firstMessage, ...nextMessages] = s.messages
    const firstNvimMessage =
      firstMessage && firstMessage.source === MessageSource.Neovim
        ? firstMessage
        : null
    if (!firstNvimMessage) {
      message.actions = addDefaultDismissAction(message)
      return { messages: [message, ...s.messages] }
    }

    firstMessage.message += message.message
    return { messages: [firstMessage, ...nextMessages] }
  },
  removeMessage: (id: string) => (s: S) => ({
    messages: s.messages.filter((m) => m.id !== id),
  }),
  clearMessages: (
    source: MessageSource,
    clearFn?: (message: IMessage) => boolean
  ) => (s: S) => ({
    messages: clearFn
      ? s.messages.filter((m) => m.source !== source && clearFn(m))
      : s.messages.filter((m) => m.source !== source),
  }),
}

type A = typeof actions

const MessageView = ($: IMessage, last: boolean) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        marginTop: '4px',
        padding: '16px 18px',
        background: cvar('background-30'),
        borderLeft: '4px solid',
        borderColor: Reflect.get(colors, $.kind),
        fontSize: '1.2rem',
      },
    },
    [
      ,
      h(
        'div',
        {
          style: {
            display: 'flex',
            paddingRight: '14px',
            fontSize: '1.6rem',
            color: Reflect.get(colors, $.kind),
          },
        },
        [, h(getIcon($.kind))]
      ),

      h(
        'div',
        {
          style: {
            display: 'flex',
            flexFlow: 'column',
            width: '100%',
          },
        },
        [
          ,
          h(
            'div',
            {
              style: {
                color: cvar('foreground-10'),
              },
            },
            $.message.split('\n').map((line) => h('div', line))
          ),

          $.kind === MessageKind.Progress &&
            h(
              'div',
              {
                style: {
                  marginTop: '20px',
                  display: 'flex',
                },
              },
              [
                ,
                h('div', {
                  style: {
                    height: '5px',
                    background: highlightColorBrighter,
                    filter: 'brighten(90%)',
                    borderRadius: '2px',
                    width: `${$.progress || 1}%`,
                    transition: 'width 0.5s',
                  },
                }),
              ]
            ),

          $.progressStatus &&
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  marginTop: '6px',
                  fontSize: '0.9rem',
                },
              },
              [
                ,
                h(
                  'div',
                  {
                    style: {
                      color: 'var(--foreground-40)',
                    },
                  },
                  $.progressStatus
                ),
              ]
            ),

          last &&
            !!$.actions.length &&
            h(
              'div',
              {
                style: {
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                },
              },
              $.actions.map((a) => Action(a.label, a.shortcutLabel))
            ),
        ]
      ),
    ]
  )

// TODO: create a highlight color from vim colorscheme
// const highlightColor = 'rgb(87, 52, 121)'
const highlightColor = 'rgb(78, 56, 100)'
const highlightColorBrighter = 'rgb(129, 84, 174)'

const Action = (label: string, shortcut: string) =>
  h(
    'div',
    {
      style: {
        marginLeft: '10px',
      },
    },
    [
      ,
      h(
        'div',
        {
          style: {
            display: 'flex',
          },
        },
        [
          ,
          h(
            'div',
            {
              style: {
                borderRadius: '2px',
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                padding: '5px 10px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: highlightColor,
                color: cvar('foreground'),
                border: 'none',
                clipPath:
                  'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
                paddingRight: '20px',
                marginRight: '-12px',
                fontSize: '1rem',
              },
            },
            label
          ),

          h(
            'div',
            {
              style: {
                clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%)',
                color: cvar('foreground-20'),
                borderRadius: '2px',
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                background: 'none',
                padding: '5px 10px',
                border: '1px solid',
                borderColor: highlightColor,
                display: 'flex',
                borderLeft: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.86rem',
                fontWeight: 'bold',
                paddingLeft: '20px',
              },
            },
            shortcut
          ),
        ]
      ),
    ]
  )

const view = ($: S) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        height: '100%',
        width: '100%',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
      },
    },
    [
      ,
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexFlow: 'column',
            maxWidth: '500px',
            minWidth: '350px',
          },
        },
        [
          ,
          void registerFirstMessageShortcuts($.messages[$.messages.length - 1]),
          $.messages.map((m, ix) =>
            MessageView(m, ix === $.messages.length - 1)
          ),
        ]
      ),
    ]
  )

// will there be more than 6 message actions?
const availableShortcuts = [
  { shortcutLabel: 'C S Y', shortcut: '<S-C-y>' },
  { shortcutLabel: 'C S T', shortcut: '<S-C-t>' },
  { shortcutLabel: 'C S U', shortcut: '<S-C-u>' },
  { shortcutLabel: 'C S R', shortcut: '<S-C-r>' },
  { shortcutLabel: 'C S E', shortcut: '<S-C-e>' },
  { shortcutLabel: 'C S W', shortcut: '<S-C-e>' },
]

const getShortcut = (index: number) =>
  availableShortcuts[index] || {
    shortcutLabel: '???',
    shortcut: '',
  }

const registerFirstMessageShortcuts = (message: IMessage) => {
  if (!message || message.stealsFocus) return

  const shortcuts = message.actions.map((m) => m.shortcut)
  registerOneTimeUseShortcuts(shortcuts, (shortcut) => {
    const action = message.actions.find((m) => m.shortcut === shortcut)
    if (action) message.onAction(action.label)
  })
}

const ui = app<S, A>({ name: 'messages', state, actions, view })

// generic close/dismiss message functionality - like the (x) button in the prompt
const addDefaultDismissAction = (msg: IMessage | Message) =>
  !msg.stealsFocus
    ? [
        {
          label: 'Dismiss',
          shortcutLabel: 'C S N',
          shortcut: '<S-C-n>',
        },
      ]
    : []

const showMessage = (
  source: MessageSource,
  message: Message
): MessageReturn => {
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
      shortcut: '<S-C-c>',
    })

  const callback = (action: string) => {
    ui.removeMessage(id)
    task.done(action)
  }

  ui.showMessage({
    ...message,
    id,
    source,
    actions,
    onAction: callback,
    progress: message.progress || 1,
    stealsFocus: message.stealsFocus || false,
  })

  const setProgress = (update: MessageStatusUpdate) =>
    ui.setMessageProgress({ ...update, id })
  const remove = () => ui.removeMessage(id)

  return { remove, setProgress, promise: task.promise }
}

export default {
  neovim: {
    show: (message: Message) => showMessage(MessageSource.Neovim, message),
    append: (message: Message) => {
      const id = uuid()
      ui.appendMessage({
        ...message,
        id,
        source: MessageSource.Neovim,
        actions: [],
        onAction: () => ui.removeMessage(id),
        stealsFocus: message.stealsFocus || false,
      })
    },
    clear: (matcher?: (message: IMessage) => boolean) => {
      ui.clearMessages(MessageSource.Neovim, matcher)
    },
  },
  vscode: {
    show: (message: Message) => showMessage(MessageSource.VSCode, message),
    clear: () => ui.clearMessages(MessageSource.VSCode),
  },
}
