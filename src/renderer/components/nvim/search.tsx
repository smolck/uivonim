import { createVNode } from 'inferno'
import {
  hideCursor,
  showCursor,
  disableCursor,
  enableCursor,
} from '../../cursor'
import { CommandType, CommandUpdate } from '../../render/events'
import * as windows from '../../windows/window-manager'
import { WindowOverlay } from '../../windows/window'
import Input from '../text-input'
import { sub } from '../../dispatch'
import { rgba, paddingV } from '../../ui/css'
import { is } from '../../../common/utils'
import { makel } from '../../ui/vanilla'
import { render } from 'inferno'

let state = {
  visible: false,
  value: '',
  position: 0,
  kind: CommandType.Ex,
  inputCallbacks: {},
}

type S = typeof state
let winOverlay: WindowOverlay

const printCommandType = (kind: CommandType) => {
  if (kind === CommandType.SearchForward) return 'forward search'
  if (kind === CommandType.SearchBackward) return 'backward search'
  // should never happen
  else return 'search'
}

const VimSearch = ({ visible, kind, value, position }: S) => (
  <div style={{ display: visible ? 'flex' : 'none', flex: 1 }}>
    <div
      style={{
        ...paddingV(20),
        display: 'flex',
        // TODO: figure out a good color from the colorscheme... StatusLine?
        background: rgba(217, 150, 255, 0.17),
        'align-items': 'center',
      }}
    >
      <span>{printCommandType(kind)}</span>
    </div>

    <Input
      id={'vim-search-input'}
      small={true}
      focus={visible}
      desc={'search query'}
      value={value}
      icon={'search'}
      position={position}
    />
  </div>
)

const container = makel({
  position: 'absolute',
  width: '100%',
  display: 'flex',
  background: 'var(--background-30)',
  visible: state.visible,
})
container.id = 'vim-search-container'
// TODO(smolck): Shouldn't be necessary, right?
// document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<VimSearch {...state} />, container)
)

const hide = () => {
  enableCursor()
  showCursor()
  if (winOverlay) winOverlay.remove()
  assignStateAndRender({ value: '', visible: false })
}

const updateQuery = ({ cmd, kind, position }: CommandUpdate) => {
  const cmdKind = kind || state.kind
  hideCursor()
  disableCursor()

  !state.visible &&
    setImmediate(() => {
      winOverlay = windows.getActive().addOverlayElement(container)
    })

  assignStateAndRender({
    position,
    kind: cmdKind,
    visible: true,
    value: is.string(cmd) && state.value !== cmd ? cmd : state.value,
  })
}

state.inputCallbacks = { hide, select: hide }

sub('search.hide', hide)
sub('search.update', updateQuery)
