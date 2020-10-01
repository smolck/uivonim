import { record, replay, recordingExists } from '../dev/recorder'
// import messages, { MessageKind } from '../components/messages'
import { stealInput, registerShortcut } from '../core/input'
import { VimMode } from '../neovim/types'
import { is } from '../support/utils'
import { h, app } from '../ui/uikit'

const state = {
  items: [],
}

const viewActions = {
  refresh: (items: any) => ({ items }),
}

const actions = new Map()

actions.set('v', {
  desc: 'run VSCODE api tests',
  fn: () => fetch('http://localhost:22444/test/vscode'),
})

actions.set('p', {
  desc: 'extension host playground',
  fn: () => fetch('http://localhost:22444/playground'),
})

actions.set('s', {
  desc: 'record all keyboard inputs for playback',
  fn: () => setTimeout(record, 150),
})

actions.set('r', {
  desc: 'replay last input recording',
  fn: () => setImmediate(replay),
  active: recordingExists,
})

const KeyVal = (key: string, val: string, active: boolean) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginTop: '5px',
        marginBottom: '5px',
        color: active ? '#fff' : '#666',
      },
    },
    [
      ,
      h(
        'span',
        {
          style: {
            fontSize: '2rem',
            fontWeight: 'bold',
            marginRight: '15px',
          },
        },
        key.toUpperCase()
      ),

      h('span', val),
    ]
  )

const container = document.createElement('div')
container.setAttribute('id', 'dev-menu')

type S = typeof state
type A = typeof viewActions

const view = ($: S) =>
  h(
    'div',
    {
      style: {
        position: 'absolute',
        zIndex: 600,
        padding: '20px',
        top: '80px',
        left: '40px',
        background: '#111',
      },
    },
    $.items.map(([key, { desc, active }]: any) => {
      const isActive = is.function(active) ? active() : true
      return KeyVal(key, desc, isActive)
    })
  )

const ui = app<S, A>({
  name: 'dev-menu',
  state,
  actions: viewActions,
  view,
  element: container,
})

registerShortcut('S-C-k', VimMode.Normal, () => {
  ui.refresh([...actions.entries()])
  document.body.appendChild(container)

  const restoreInput = stealInput((key) => {
    const action = actions.get(key)

    if (action) {
      if (is.function(action.active) && action.active() === false) {
        restoreInput()
        container.remove()
        return
      }

      // messages.vscode.show({
      //   message: `running: ${action.desc}`,
      //   kind: MessageKind.System,
      // })
      action.fn()
    }

    restoreInput()
    container.remove()
  })
})
