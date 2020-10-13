import { stealInput } from '../../core/input'
import { render } from 'inferno'
import api from '../../core/instance-api'

let state = {
  visible: false,
}

type S = typeof state

const Nyancat = ({ visible }: S) => (
    <div style={{
      background: `url('../assets/nc.gif')`,
      display: visible ? 'block' : 'none',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '75vw',
      position: 'absolute',
      height: '100%',
      width: '100%',
    }} />
)

const plugins = document.getElementById('plugins')
const container = document.createElement('div')
plugins?.appendChild(container)

const show = () => (state.visible = true, render(<Nyancat {...state} />, container))
const hide = () => {
    if (state.visible) {
        state.visible = false
        render(<Nyancat {...state} />, container)
    }
}

api.onAction('nc', () => {
  show()
  const restoreInput = stealInput(() => {
    restoreInput()
    hide()
  })
})
