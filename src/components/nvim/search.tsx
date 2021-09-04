import { CommandType, CommandUpdate } from '../../types'
import { Window, WindowOverlay } from '../../windows/window'
import Input from '../text-input'
import { rgba, paddingV } from '../../ui/css'
import { is } from '../../utils'
import { makel } from '../../ui/vanilla'
import { render } from 'inferno'

let state = {
  visible: false,
  value: '',
  position: 0,
  kind: CommandType.Ex,
  hideCb: () => {},
}

export const setSearchHideCallback = (cb: () => void) => {
  state.hideCb = cb
  console.warn(
    'search.tsx: TODO(smolck): this is kinda hacky, maybe do something about that'
  )
}

type S = typeof state
let winOverlay: WindowOverlay

const printCommandType = (kind: CommandType) => {
  if (kind === CommandType.SearchForward) return 'forward search'
  if (kind === CommandType.SearchBackward) return 'backward search'
  // should never happen
  else return 'search'
}

const VimSearch = ({ loadingSize, visible, kind, value, position, hideCb }: S & { loadingSize: number }) => (
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
      loadingSize={loadingSize}
      id={'vim-search-input'}
      small={true}
      focus={visible}
      hide={hideCb}
      select={hideCb}
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

const assignStateAndRender = (loadingSize: number, newState: any) => (
  Object.assign(state, newState), render(<VimSearch {...state} loadingSize={loadingSize}/>, container)
)

export const hideSearch = (loadingSize: number) => {
  if (winOverlay) winOverlay.remove()
  assignStateAndRender(loadingSize, { value: '', visible: false })
}

export const updateSearch = (
  activeWindow: Window,
  loadingSize: number,
  { cmd, kind, position }: CommandUpdate
) => {
  const cmdKind = kind || state.kind

  !state.visible &&
    setTimeout(() => {
      winOverlay = activeWindow.addOverlayElement(container)
    }, 1)

  assignStateAndRender(loadingSize, {
    position,
    kind: cmdKind,
    visible: true,
    value: is.string(cmd) && state.value !== cmd ? cmd : state.value,
  })
}
