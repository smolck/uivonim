import { CommandType, CommandUpdate } from '../../types'
import { Plugin } from '../plugin-container'
import { RowNormal } from '../row-container'
import Input from '../text-input'
import { is } from '../../utils'
import { render } from 'inferno'

const modeSwitch = new Map([
  [CommandType.Ex, 'command'],
  [CommandType.Prompt, 'chevrons-right'],
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
  loadingSize,
  options,
  position,
  value,
  prompt,
  visible,
  kind,
  ix: stateIx,
}: S & { loadingSize: number }) => {
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
        loadingSize={loadingSize}
        id={'command-line-input'}
        focus={true}
        value={value}
        desc={kind === CommandType.Ex ? 'command line' : 'prompt'}
        position={position}
        icon={
          value.startsWith('lua ') && kind === CommandType.Ex
            ? 'moon'
            : modeSwitch.get(kind) || 'command'
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

// TODO(smolck): Is this slow? Necessary? Done in other files as well, since
// otherwise Inferno overwrites the DOM and that causes issues.
const plugins = document.getElementById('plugins')
const container = document.createElement('div')
container.id = 'command-line-container'
plugins?.appendChild(container)

// TODO: use export cns. this component is a high priority so it should be loaded early
// because someone might open cmdline early
export const wildmenuShow = (loadingSize: number, items: any[]) => {
  state.options = [...new Set(items.map((item) => item.word))]
  render(<CommandLine {...state} loadingSize={loadingSize} />, container)
}

export const wildmenuSelect = (loadingSize: number, ix: number) => {
  state.ix = ix
  render(<CommandLine {...state} loadingSize={loadingSize} />, container)
}

export const wildmenuHide = (loadingSize: number) => {
  state.options = [...new Set([])]
  render(<CommandLine {...state} loadingSize={loadingSize} />, container)
}

export const cmdlineHide = (loadingSize: number) => {
  // TODO(smolck)
  document.getElementById('keycomp-textarea')?.focus()

  state.visible = false

  render(<CommandLine {...state} loadingSize={loadingSize} />, container)
}

export const cmdlineUpdate = (
  loadingSize: number,
  { cmd, kind, position, prompt }: CommandUpdate
) => {
  if (kind) state.kind = kind
  if (prompt) state.prompt = prompt
  state.position = position
  state.visible = true
  state.options = cmd ? state.options : []
  state.value = is.string(cmd) && state.value !== cmd ? cmd : state.value

  render(<CommandLine {...state} loadingSize={loadingSize} />, container)
}
