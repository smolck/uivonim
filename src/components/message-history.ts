import { MessageKind, Message } from '../protocols/veonim'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import { colors } from '../ui/styles'

const state = {
  query: '',
  messages: [] as Message[],
  cache: [] as Message[],
  vis: false,
  ix: 0,
}

type S = typeof state

let elref: HTMLElement
const SCROLL_AMOUNT = 0.4

const iconStyle = { fontSize: '1.2rem' }

const icons = new Map([
  [
    MessageKind.Error,
    h(Icon.XCircle, { color: colors.error, style: iconStyle }),
  ],
  [
    MessageKind.Warning,
    h(Icon.AlertTriangle, { color: colors.warning, style: iconStyle }),
  ],
  [
    MessageKind.Success,
    h(Icon.CheckCircle, { color: colors.success, style: iconStyle }),
  ],
  [
    MessageKind.Info,
    h(Icon.MessageCircle, { color: colors.info, style: iconStyle }),
  ],
  [
    MessageKind.Hidden,
    h(Icon.MessageCircle, { color: colors.info, style: iconStyle }),
  ],
  [
    MessageKind.System,
    h(Icon.AlertCircle, { color: colors.system, style: iconStyle }),
  ],
])

const getIcon = (kind: MessageKind) =>
  icons.get(kind) || icons.get(MessageKind.Info)

const actions = {
  show: (messages: Message[]) => (
    vimBlur(), { messages, cache: messages, vis: true }
  ),
  hide: () => (vimFocus(), { vis: false, query: '', ix: 0 }),

  change: (query: string) => (s: S) => ({
    query,
    ix: 0,
    messages: query ? filter(s.messages, query, { key: 'message' }) : s.cache,
  }),

  next: () => (s: S) => ({ ix: s.ix + 1 >= s.messages.length ? 0 : s.ix + 1 }),
  prev: () => (s: S) => ({
    ix: s.ix - 1 < 0 ? s.messages.length - 1 : s.ix - 1,
  }),

  down: () => {
    const { height } = elref.getBoundingClientRect()
    elref.scrollTop += Math.floor(height * SCROLL_AMOUNT)
  },

  up: () => {
    const { height } = elref.getBoundingClientRect()
    elref.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
  },
}

const view = ($: S, a: typeof actions) =>
  h(
    'div',
    {
      style: {
        background: 'var(--background-45)',
        color: '#eee',
        display: $.vis ? 'flex' : 'none',
        flexFlow: 'column',
        position: 'absolute',
        alignSelf: 'flex-end',
        maxHeight: '85vh',
        width: '100%',
      },
    },
    [
      ,
      Input({
        next: a.next,
        prev: a.prev,
        up: a.up,
        hide: a.hide,
        down: a.down,
        change: a.change,
        value: $.query,
        focus: true,
        small: true,
        icon: Icon.Filter,
        desc: 'filter messages',
      }),

      h(
        'div',
        {
          oncreate: (e: HTMLElement) => {
            if (e) elref = e
          },
          style: { overflowY: 'hidden' },
        },
        $.messages.map(({ kind, message }, pos) =>
          h(
            RowNormal,
            {
              active: pos === $.ix,
            },
            [
              ,
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    paddingRight: '10px',
                  },
                },
                [, getIcon(kind)]
              ),

              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    color: (icons.get(kind) || icons.get(MessageKind.Info))!
                      .color,
                  },
                },
                message
              ),
            ]
          )
        )
      ),
    ]
  )

const ui = app({ name: 'message-history', state, actions, view })

export const showMessageHistory = (messages: Message[]) => ui.show(messages)
