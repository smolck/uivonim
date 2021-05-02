import { createVNode } from 'inferno'
import { getColorByName } from '../../render/highlight-attributes'
import { sub, processAnyBuffered } from '../../dispatch'
import { darken, brighten, cvar } from '../../ui/css'
import { ExtContainer } from '../../../common/types'
import Icon from '../icon'
import { colors } from '../../ui/styles'
import { basename } from 'path'
import { render } from 'inferno'

interface Tab {
  tab: ExtContainer
  name: string
}

interface TabInfo {
  id: number
  name: string
}

interface TabView {
  id: number
  label: number
  active: boolean
}

let state = {
  tabs: [] as TabInfo[],
  active: -1,
  filetype: '',
  // TODO(smolck): No longer necessary? runningServers: new Set<string>(),
  message: '',
  controlMessage: '',
  line: 0,
  column: 0,
  cwd: '',
  errors: 0,
  warnings: 0,
  branch: '',
  additions: 0,
  deletions: 0,
  baseColor: '#4e415a',
}

type S = typeof state

const statusGroupStyle: CSSProperties = {
  display: 'flex',
  'flex-direction': 'row',
  'align-items': 'center',
}

const itemStyle = {
  color: cvar('foreground-40'),
  display: 'flex',
  height: '100%',
  'align-items': 'center',
  'padding-left': '20px',
  'padding-right': '20px',
}

const iconBoxStyle: CSSProperties = {
  display: 'flex',
  'padding-right': '4px',
  'align-items': 'center',
}

const container = document.getElementById('statusline') as HTMLElement

Object.assign(container.style, {
  height: '24px',
  display: 'flex',
  'z-index': 900,
})

const Statusline = ({
  baseColor,
  cwd,
  branch,
  additions,
  deletions,
  message,
  controlMessage,
  errors,
  warnings,
  line,
  column,
  tabs,
  active,
}: S) => {
  const additionsIcon = (
    <div
      style={{
        ...iconBoxStyle,
        color: additions > 0 ? colors.success : undefined,
      }}
    >
      <Icon icon={'plus-square'} style={iconStyle} />
    </div>
  )

  const additionsText = (
    <div
      style={{
        color: additions > 0 ? colors.success : undefined,
        'padding-bottom': '1px',
      }}
    >
      {additions}
    </div>
  )

  const deletionsIcon = (
    <div
      style={{
        ...iconBoxStyle,
        color: deletions > 0 ? colors.error : undefined,
        'margin-left': '12px',
      }}
    >
      <Icon icon={'minus-square'} style={iconStyle} />
    </div>
  )

  const deletionsText = (
    <div
      style={{
        color: deletions > 0 ? colors.error : undefined,
        'padding-bottom': '1px',
      }}
    >
      {deletions}
    </div>
  )

  const left = (
    <div style={statusGroupStyle}>
      <div
        style={
          {
            ...itemStyle,
            color: brighten(baseColor, 90),
            background: darken(baseColor, 20),
            'padding-left': '15px',
            'padding-right': '30px',
            'margin-right': '-15px',
            'clip-path': 'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 0 100%)',
          } as CSSProperties
        }
      >
        <div style={iconBoxStyle}>
          <Icon icon={'hard-drive'} style={iconStyle} />
        </div>

        <Label label={cwd || 'main'} />
      </div>

      {branch && (
        <div
          style={
            {
              ...itemStyle,
              color: brighten(baseColor, 40),
              background: darken(baseColor, 35),
              'padding-left': '30px',
              'padding-right': '30px',
              'margin-right': '-15px',
              'clip-path':
                'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 15px 100%)',
            } as CSSProperties
          }
        >
          <div
            style={{
              ...iconBoxStyle,
              display: branch ? '' : 'none',
              'padding-top': '4px',
            }}
          >
            <Icon icon={'git-branch'} style={iconStyle} />
          </div>

          <Label label={branch} />
        </div>
      )}

      {branch && (
        <div
          style={
            {
              ...itemStyle,
              color: brighten(baseColor, 10),
              background: darken(baseColor, 50),
              'padding-left': '30px',
              'padding-right': '30px',
              'margin-right': '-15px',
              'clip-path':
                'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 15px 100%)',
            } as CSSProperties
          }
        >
          {additionsIcon}
          {additionsText}

          {deletionsIcon}
          {deletionsText}
        </div>
      )}

      <div>
        <div
          style={{
            color: cvar('foreground-60'),
            'padding-bottom': '1px',
            'margin-left': '26px',
          }}
        >
          {message}
        </div>
      </div>
    </div>
  )

  const errorsIcon = (
    <div
      style={{
        ...iconBoxStyle,
        color: errors > 0 ? colors.error : undefined,
      }}
    >
      <Icon icon={'x-circle'} style={iconStyle} />
    </div>
  )

  const errorsText = (
    <div
      style={{
        'padding-bottom': '1px',
        color: errors > 0 ? colors.error : undefined,
      }}
    >
      {errors}
    </div>
  )

  const warningsIcon = (
    <div
      style={{
        ...iconBoxStyle,
        color: warnings > 0 ? colors.warning : undefined,
        'margin-left': '12px',
      }}
    >
      <Icon icon={'alert-triangle'} style={iconStyle} />
    </div>
  )

  const warningsText = (
    <div
      style={{
        color: warnings > 0 ? colors.warning : undefined,
        'padding-bottom': '1px',
      }}
    >
      {warnings}
    </div>
  )

  const right = (
    <div style={statusGroupStyle}>
      <div>
        <div
          style={{
            'margin-right': '10px',
            'padding-bottom': '1px',
            color: cvar('foreground-60'),
          }}
        >
          {controlMessage}
        </div>
      </div>

      <div
        style={
          {
            ...itemStyle,
            color: brighten(baseColor, 10),
            background: darken(baseColor, 50),
            'padding-left': '30px',
            'padding-right': '30px',
            'margin-right': '-15px',
            'clip-path':
              'polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%)',
          } as CSSProperties
        }
      >
        {errorsIcon}
        {errorsText}

        {warningsIcon}
        {warningsText}
      </div>

      <div
        style={
          {
            ...itemStyle,
            color: brighten(baseColor, 60),
            background: darken(baseColor, 30),
            'padding-left': '30px',
            'padding-right': '30px',
            'margin-right': '-15px',
            'padding-bottom': '1px',
            'clip-path':
              'polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%)',
          } as CSSProperties
        }
      >
        <div>
          {line + 1}:{column + 1}
        </div>
      </div>

      <div style={{ display: 'flex', height: '100%' }}>
        {tabs.map(({ id }, ix) => (
          <Tab id={id} label={ix + 1} active={active === id} />
        ))}
      </div>
    </div>
  )

  return (
    <div
      style={{
        flex: '1',
        display: 'flex',
        background: cvar('background-30'),
        'z-index': 999,
        'justify-content': 'space-between',
      }}
    >
      {left}
      {right}
    </div>
  )
}

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<Statusline {...state} />, container)
)

const iconStyle = { 'font-size': '16px' }

const Label = ({ label }: { label: string }) => (
  <div style={{ 'padding-bottom': '1px' }}>{label}</div>
)

const Tab = ({ id, label, active }: TabView) => (
  <div
    key={id}
    style={
      {
        ...itemStyle,
        'padding-left': '20px',
        'padding-right': '20px',
        'margin-right': '-14px',
        'padding-bottom': '1px',
        'clip-path': 'polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%)',
        color: cvar('foreground-40'),
        ...(active
          ? { background: cvar('background-10'), color: cvar('foreground') }
          : undefined),
      } as CSSProperties
    }
  >
    {label}
  </div>
)

const watchState = window.api.nvimWatchState
watchState.filetype((filetype: string) => assignStateAndRender({ filetype }))
watchState.line((line: number) => assignStateAndRender({ line }))
watchState.column((column: number) => assignStateAndRender({ column }))
watchState.cwd((cwd: string) => {
  const next = basename(cwd)
  assignStateAndRender({ cwd: next })
})

sub('tabs', async ({ curtab, tabs }: { curtab: ExtContainer; tabs: Tab[] }) => {
  const mtabs: TabInfo[] = tabs.map((t) => ({ id: t.tab.id, name: t.name }))
  mtabs.length > 1
    ? assignStateAndRender({ active: curtab.id, tabs: mtabs })
    : assignStateAndRender({ active: -1, tabs: [] })
})

window.api.gitOnBranch((branch) => assignStateAndRender({ branch }))
window.api.gitOnStatus((status) =>
  assignStateAndRender({
    additions: status.additions,
    deletions: status.deletions,
  })
)
// sub('ai.diagnostics.count', (count) => ui.setDiagnostics(count))
// sub('ai.start', (opts) => ui.aiStart(opts))
sub('message.status', (msg) => assignStateAndRender({ message: msg }))
sub('message.control', (msg) => assignStateAndRender({ controlMessage: msg }))

watchState.colorscheme(async () => {
  const { background } = await getColorByName('StatusLine')
  if (background) assignStateAndRender({ baseColor: background })
})

setImmediate(async () => {
  processAnyBuffered('tabs')
  const { background } = await getColorByName('StatusLine')
  if (background) assignStateAndRender({ baseColor: background })
})
