import { sub } from '../messaging/dispatch'
import { h, app } from '../ui/uikit'

const state = {
  visible: false,
  content: '',
}

type S = typeof state

const actions = {
  show: (msg: string) => {
    return { content: msg, visible: true }
  },
  hide: () => (s: S) => {
    if (s.visible) return { visible: false, content: '' }
  },
}

let elref: HTMLElement
const view = ($: S) =>
  h(
    'div',
    {
      oncreate: (e: any) => (elref = e),
      style: {
        display: $.visible ? 'flex' : 'none',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        height: '100%',
        width: '100%',
      },
    },
    [
      ,
      h(
        'pre',
        {
          style: {
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '10px',
            color: '#fff',
          },
        },
        $.content
      ),
    ]
  )

const ui = app<S, typeof actions>({ name: 'spell-check', state, actions, view })

sub('msg:spell-check', (msg) => ui.show(msg))

sub('hack:input-keys', (inputKeys) => {
  const cancel = inputKeys === '<Esc>' || inputKeys === '<Enter>'
  if (elref.style.display === 'flex' && cancel) ui.hide()
})
