import {
  enableCursor,
  disableCursor,
  hideCursor,
  showCursor,
} from '../core/cursor'
import { CommandType, CommandUpdate } from '../render/events'
import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import Input from '../components/text-input'
import { sub } from '../messaging/dispatch'
import { is } from '../support/utils'
import { render } from 'inferno'
const feather = require('feather-icons')

const modeSwitch = new Map([
  [CommandType.Ex, feather.icons.command.toSvg()],
  [CommandType.Prompt, feather.icons['chevrons-right'].toSvg()],
])

let state = {
  options: [] as string[],
  visible: false,
  value: '',
  ix: 0,
  position: 0,
  prompt: '',
  kind: CommandType.Ex,
}

type S = typeof state

const CommandLine = ({
  options,
  position,
  value,
  prompt,
  visible,
  kind,
  ix: stateIx,
}: S) => {
  const maybePrompt = prompt && (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        background: 'var(--background-50)',
        'margin-top': '-40px',
        height: '40px',
        display: 'flex',
        'align-items': 'center',
      }}
    >
      <div style={{ padding: '0 15px', 'font-size': '1.1rem' }}>{prompt}</div>
    </div>
  )

  return (
    // @ts-ignore
    <Plugin
      id={'command-line'}
      extraStyle={{ position: 'relative' }}
      visible={visible}
    >
      {maybePrompt}
      <Input
        focus={true}
        value={value}
        desc={kind === CommandType.Ex ? 'command line' : 'prompt'}
        position={position}
        icon={
          value.startsWith('lua ') && kind === CommandType.Ex
            ? feather.icons.moon.toSvg()
            : modeSwitch.get(kind) || feather.icons.command.toSvg()
        }
      />
      <div>
        {options.map((name, ix) => (
          <RowNormal active={ix === stateIx}>
            <div>{name}</div>
          </RowNormal>
        ))}
      </div>
    </Plugin>
  )
}

const container = document.getElementById('plugins')

// TODO: use export cns. this component is a high priority so it should be loaded early
// because someone might open cmdline early
sub('wildmenu.show', (opts: any[]) => {
  state.options = [...new Set(opts)]

  render(<CommandLine {...state} />, container)
})
sub('wildmenu.select', (ix) => {
  state.ix = ix

  render(<CommandLine {...state} />, container)
})

sub('wildmenu.hide', () => {
  ;(state.options = [...new Set([])]),
    render(<CommandLine {...state} />, container)
})

sub('cmd.hide', () => {
  enableCursor()
  showCursor()

  state.visible = false

  render(<CommandLine {...state} />, container)
})

sub('cmd.update', ({ cmd, kind, position, prompt }: CommandUpdate) => {
  hideCursor()
  disableCursor()

  state.kind = kind
  if (prompt) state.prompt = prompt
  state.position = position
  state.visible = true
  state.options = cmd ? state.options : []
  state.value = is.string(cmd) && state.value !== cmd ? cmd : state.value

  render(<CommandLine {...state} />, container)
})
