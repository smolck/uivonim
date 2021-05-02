import { createVNode } from 'inferno'
//import { stealInput } from '../../core/input'
import { render } from 'inferno'
import { Events } from '../../../common/ipc'
// import api from '../../core/instance-api'

let state = {
  visible: false,
}

type S = typeof state

const Nyancat = ({ visible }: S) => (
  <div
    style={{
      background: `url('../assets/nc.gif')`,
      display: visible ? 'block' : 'none',
      position: 'absolute',
      height: '100%',
      width: '100%',
      'background-repeat': 'no-repeat',
      'background-size': '75vw',
    }}
  />
)

const plugins = document.getElementById('plugins')
const container = document.createElement('div')
plugins?.appendChild(container)

const show = () => (
  (state.visible = true), render(<Nyancat {...state} />, container)
)
const hide = () => {
  if (state.visible) {
    state.visible = false
    render(<Nyancat {...state} />, container)
  }
}

window.api.on(Events.ncAction, () => {
  show()
  // TODO(smolck): Need to `await` any of this?
  window.api.stealInput(() => {
    window.api.restoreInput()
    hide()
  })
})
