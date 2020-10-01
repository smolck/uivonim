import * as windows from '../windows/window-manager'
import * as dispatch from '../messaging/dispatch'
import ColorPicker from '../ui/color-picker'
import Overlay from '../components/overlay'
import { debounce } from '../support/utils'
import { stealInput } from '../core/input'
import onLoseFocus from '../ui/lose-focus'
import { basename, extname } from 'path'
import { cursor } from '../core/cursor'
import api from '../core/instance-api'
import { h, app } from '../ui/uikit'

let liveMode = false
let restoreInput = () => {}

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
  if (!api.nvim.state.file.endsWith('.vim')) return

  const colorschemeBeingEdited = basename(
    api.nvim.state.file,
    extname(api.nvim.state.file)
  )
  const currentActiveColorscheme = api.nvim.state.colorscheme

  if (currentActiveColorscheme !== colorschemeBeingEdited) return

  api.nvim.cmd(`write`)
  api.nvim.cmd(`colorscheme ${currentActiveColorscheme}`)
  dispatch.pub('colorscheme.modified')
}, 300)

const state = {
  x: 0,
  y: 0,
  visible: false,
  anchorBottom: false,
}

const actions = {
  show: () => ({ visible: true, ...getPosition(cursor.row, cursor.col) }),
  hide: () => ({ visible: false }),
}

const view = ($: typeof state, a: typeof actions) =>
  Overlay(
    {
      x: $.x,
      y: $.y,
      zIndex: 900,
      visible: $.visible,
      anchorAbove: $.anchorBottom,
    },
    [
      ,
      h('.show-cursor', {
        onupdate: (e: HTMLElement) =>
          onLoseFocus(e, () => (a.hide(), restoreInput())),
        oncreate: (e: HTMLElement) => e.appendChild(colorPicker.element),
      }),
    ]
  )

const ui = app({ name: 'color-picker', state, actions, view })

const show = (color: string) => {
  // TODO: conditionally call setRGB or setHSL depending on input
  // this will depend on functionality to parse/edit rgba+hsla
  // colors from text.
  colorPicker.setHex(color)
  // colorPicker.setRGB(r, g, b, a)
  // colorPicker.setHSL(h, s, l, a)
  ui.show()

  restoreInput = stealInput((keys) => {
    if (keys !== '<Esc>') return
    restoreInput()
    ui.hide()
  })
}

colorPicker.onChange((color) => {
  // TODO: will also need to send what kind of color is updated, that way
  // we know which text edit to apply (rgba or hsla, etc.)
  api.nvim.cmd(`exec "normal! ciw${color}"`)
  possiblyUpdateColorScheme()
})

api.onAction('pick-color', async () => {
  liveMode = false
  const word = await api.nvim.call.expand('<cword>')
  show(word)
})

api.onAction('modify-colorscheme-live', async () => {
  liveMode = true
  const word = await api.nvim.call.expand('<cword>')
  show(word)
})
