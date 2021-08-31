import * as windows from '../../windows/window-manager'
import * as dispatch from '../../dispatch'
import ColorPicker from '../../ui/color-picker'
import Overlay from '../overlay'
import { debounce } from '../../utils'
import onLoseFocus from '../../ui/lose-focus'
import { basename, extname } from 'path'
import { cursor } from '../../cursor'
import { render } from 'inferno'
import { invoke, listen, stealInput, restoreInput } from '../../helpers'

let liveMode = false

const getPosition = (row: number, col: number) => ({
  ...windows.pixelPosition(row > 12 ? row : row + 1, col - 1),
  anchorBottom: row > 12,
})

const colorPicker = ColorPicker()

// TODO: this will save/modify the current colorscheme file. any way to
// short-circuit the save through an alt temp file or other clever method?
//
// actually, in the new revised ui grid protocol, we should be receiving
// semantic ui coloring names instead of hardcoded values. aka will receive
// this text: 'blah', this hlgrp: 'NORMAL'. a separate msg will send the
// values for hlgroups. we can use this new format to redraw the screen
// with our custom hlgroup values (temporarily) instead of the neovim
// specified hlgroup values
const possiblyUpdateColorScheme = debounce(() => {
  if (!liveMode) return
  if (!window.api.nvimState().file.endsWith('.vim')) return

  const colorschemeBeingEdited = basename(
    window.api.nvimState().file,
    extname(window.api.nvimState().file)
  )
  const currentActiveColorscheme = window.api.nvimState().colorscheme

  if (currentActiveColorscheme !== colorschemeBeingEdited) return

  const cmd = (cmd: string) => invoke.nvimCmd({ cmd })
  cmd(`write`)
  cmd(`colorscheme ${currentActiveColorscheme}`)
  dispatch.pub('colorscheme.modified')
}, 300)

let state = {
  x: 0,
  y: 0,
  visible: false,
  anchorBottom: false,
  hideFunc: () => {}, // TODO(smolck)
}

const WhyDiv = (props: any) => <div {...props} />

let elref: HTMLElement | undefined
const ColorPickerView = ({
  x,
  y,
  visible,
  anchorBottom,
  hideFunc,
}: typeof state) => (
  <Overlay x={x} y={y} visible={visible} anchorAbove={anchorBottom}>
    <WhyDiv
      class={'show-cursor'}
      onComponentDidMount={(e: HTMLElement) => (
        e.appendChild(colorPicker.element), (elref = e)
      )}
      onComponentDidUpdate={(_lastProps: any, _nextProps: any) => {
        if (elref) {
          onLoseFocus(elref, () => (hideFunc(), restoreInput()))
        } // TODO(smolck): Else . . . sadness?
      }}
    />
  </Overlay>
)

const container = document.createElement('div')
container.id = 'color-picker-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState),
  render(<ColorPickerView {...state} />, container)
)

const uiShow = () =>
  assignStateAndRender({
    visible: true,
    ...getPosition(cursor.row, cursor.col),
  })
state.hideFunc = () => assignStateAndRender({ visible: false })

const show = (color: string) => {
  // TODO: conditionally call setRGB or setHSL depending on input
  // this will depend on functionality to parse/edit rgba+hsla
  // colors from text.
  colorPicker.setHex(color)
  // colorPicker.setRGB(r, g, b, a)
  // colorPicker.setHSL(h, s, l, a)
  uiShow()

  stealInput((keys: string) => {
    if (keys !== '<Esc>') return
    restoreInput().then(() => state.hideFunc())
  })
}

colorPicker.onChange((color) => {
  // TODO: will also need to send what kind of color is updated, that way
  // we know which text edit to apply (rgba or hsla, etc.)
  invoke.nvimCmd({ cmd: `exec "normal! ciw${color}"` })
    .then(() => possiblyUpdateColorScheme())
})

listen.pickColor(async () => {
  liveMode = false
  const word = await invoke.expand({ thing: '<cword>' })
  show(word)
})

// TODO(smolck): This is not a thing anymore, maybe should add it back? But is
// it really even that useful?
/*listen.modifyColorschemeLive(async () => {
  liveMode = true
  const word = await invoke.expand({ thing: '<cword>' })
  show(word)
})*/
