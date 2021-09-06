// import * as dispatch from '../../dispatch'
import ColorPicker from '../../ui/color-picker'
import Overlay from '../overlay'
// import { debounce } from '../../utils'
import onLoseFocus from '../../ui/lose-focus'
// import { basename, extname } from 'path'
import { Component } from 'inferno'
import {
  invoke,
  stealInput,
  restoreInput,
  // currentNvimState,
} from '../../helpers'

// TODO(smolck): Live colorscheme changing? Figure that out I guess.

// TODO: this will save/modify the current colorscheme file. any way to
// short-circuit the save through an alt temp file or other clever method?
//
// actually, in the new revised ui grid protocol, we should be receiving
// semantic ui coloring names instead of hardcoded values. aka will receive
// this text: 'blah', this hlgrp: 'NORMAL'. a separate msg will send the
// values for hlgroups. we can use this new format to redraw the screen
// with our custom hlgroup values (temporarily) instead of the neovim
// specified hlgroup values
/*const possiblyUpdateColorScheme = debounce(() => {
  if (!liveMode) return
  if (!currentNvimState().current_file.endsWith('.vim')) return

  const colorschemeBeingEdited = basename(
    currentNvimState().current_file,
    extname(currentNvimState().current_file)
  )
  const currentActiveColorscheme = currentNvimState().colorscheme

  if (currentActiveColorscheme !== colorschemeBeingEdited) return

  const cmd = (cmd: string) => invoke.nvimCmd({ cmd })
  cmd(`write`)
  cmd(`colorscheme ${currentActiveColorscheme}`)
  dispatch.pub('colorscheme.modified')
}, 300)*/

const WhyDiv = (props: any) => <div {...props} />

// TODO(smolck): This is not a thing anymore, maybe should add it back? But is
// it really even that useful?
/*listen.modifyColorschemeLive(async () => {
  liveMode = true
  const word = await invoke.expand({ thing: '<cword>' })
  show(word)
})*/

type Props = {
  visible: boolean
  x: number
  y: number
  anchorBottom: boolean
  cword: string
}

export default class ColorPickerComponent extends Component<
  Props,
  {
    visible: boolean
    elref: HTMLElement | undefined
    colorPicker: ReturnType<typeof ColorPicker>
  }
> {
  constructor(props: Props) {
    super(props)

    const colorPicker = ColorPicker()
    colorPicker.setHex(props.cword)
    // TODO: conditionally call setRGB or setHSL depending on input
    // this will depend on functionality to parse/edit rgba+hsla
    // colors from text.
    // colorPicker.setRGB(r, g, b, a)
    // colorPicker.setHSL(h, s, l, a)

    colorPicker.onChange((color) => {
      // TODO: will also need to send what kind of color is updated, that way
      // we know which text edit to apply (rgba or hsla, etc.)
      invoke.nvimCmd({ cmd: `exec "normal! ciw${color}"` })
      // .then(() => possiblyUpdateColorScheme())
    })

    this.state = {
      visible: props.visible,
      elref: undefined,
      colorPicker,
    }
  }

  render() {
    stealInput((keys: string) => {
      if (keys !== '<Esc>') return
      restoreInput().then(() => this.setState({ visible: false }))
    })

    return (
      <Overlay
        x={this.props.x}
        y={this.props.y}
        visible={this.state!.visible}
        anchorAbove={this.props.anchorBottom}
      >
        <WhyDiv
          class={'show-cursor'}
          onComponentDidMount={(e: HTMLElement) => (
            e.appendChild(this.state!.colorPicker.element),
            this.setState({ elref: e })
          )}
          onComponentDidUpdate={(_lastProps: any, _nextProps: any) => {
            if (this.state!.elref) {
              onLoseFocus(
                this.state!.elref,
                () => (this.setState({ visible: false }), restoreInput())
              )
            } // TODO(smolck): Else . . . sadness?
          }}
        />
      </Overlay>
    )
  }
}
