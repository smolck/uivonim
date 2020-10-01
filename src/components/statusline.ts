import { onSwitchVim, getCurrentName } from '../core/instance-manager'
import { getColorByName } from '../render/highlight-attributes'
import { sub, processAnyBuffered } from '../messaging/dispatch'
import { darken, brighten, cvar } from '../ui/css'
import { ExtContainer } from '../neovim/protocol'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { colors } from '../ui/styles'
import { h, app } from '../ui/uikit'
import { basename } from 'path'
import { homedir } from 'os'

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

const state = {
  tabs: [] as TabInfo[],
  active: -1,
  filetype: '',
  runningServers: new Set<string>(),
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

const statusGroupStyle = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
}

const itemStyle = {
  color: cvar('foreground-40'),
  display: 'flex',
  height: '100%',
  alignItems: 'center',
  paddingLeft: '20px',
  paddingRight: '20px',
}

const iconBoxStyle = {
  display: 'flex',
  paddingRight: '4px',
  alignItems: 'center',
}

const container = document.getElementById('statusline') as HTMLElement

Object.assign(container.style, {
  height: '24px',
  display: 'flex',
  zIndex: 900,
})

const actions = {
  setMessage: (message: string) => ({ message }),
  setControlMessage: (controlMessage: string) => ({ controlMessage }),
  updateTabs: ({ active, tabs }: any) => ({ active, tabs }),
  setFiletype: (filetype: any) => ({ filetype }),
  setLine: (line: any) => ({ line }),
  setColumn: (column: any) => ({ column }),
  setCwd: (cwd: string) => ({ cwd }),
  setDiagnostics: ({ errors = 0, warnings = 0 }: any) => ({ errors, warnings }),
  setGitBranch: (branch: any) => ({ branch }),
  setGitStatus: ({ additions, deletions }: any) => ({ additions, deletions }),
  setColor: (baseColor: any) => ({ baseColor }),
  aiStart: ({ cwd, filetype }: any) => (s: S) => ({
    runningServers: new Set([...s.runningServers, cwd + filetype]),
  }),
}

const iconStyle = { style: { fontSize: '16px' } }

const Label = (label: string) =>
  h(
    'div',
    {
      style: {
        paddingBottom: '1px',
      },
    },
    label
  )

const Tab = ({ id, label, active }: TabView) =>
  h(
    'div',
    {
      key: id,
      style: {
        ...itemStyle,
        paddingLeft: '20px',
        paddingRight: '20px',
        marginRight: '-14px',
        paddingBottom: '1px',
        clipPath: 'polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%)',
        color: cvar('foreground-40'),
        ...(active
          ? {
              background: cvar('background-10'),
              color: cvar('foreground'),
            }
          : undefined),
      },
    },
    label
  )

const view = ($: S) =>
  h(
    'div',
    {
      style: {
        flex: '1',
        display: 'flex',
        justifyContent: 'space-between',
        background: cvar('background-30'),
        zIndex: '999',
      },
    },
    [
      ,
      // LEFT
      h(
        'div',
        {
          style: statusGroupStyle,
        },
        [
          ,
          h(
            'div',
            {
              style: {
                ...itemStyle,
                paddingLeft: '15px',
                color: brighten($.baseColor, 90),
                background: darken($.baseColor, 20),
                paddingRight: '30px',
                marginRight: '-15px',
                clipPath:
                  'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 0 100%)',
              },
            },
            [
              ,
              h(
                'div',
                {
                  style: iconBoxStyle,
                },
                [, h(Icon.HardDrive, iconStyle)]
              ),

              Label($.cwd || 'main'),
            ]
          ),

          $.branch &&
            h(
              'div',
              {
                style: {
                  ...itemStyle,
                  paddingLeft: '30px',
                  paddingRight: '30px',
                  marginRight: '-15px',
                  color: brighten($.baseColor, 40),
                  background: darken($.baseColor, 35),
                  clipPath:
                    'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 15px 100%)',
                },
              },
              [
                ,
                h(
                  'div',
                  {
                    style: {
                      ...iconBoxStyle,
                      paddingTop: '4px',
                      display: $.branch ? '' : 'none',
                    },
                  },
                  [h(Icon.GitBranch, iconStyle)]
                ),

                Label($.branch),
              ]
            ),

          $.branch &&
            h(
              'div',
              {
                style: {
                  ...itemStyle,
                  paddingLeft: '30px',
                  paddingRight: '30px',
                  marginRight: '-15px',
                  color: brighten($.baseColor, 10),
                  background: darken($.baseColor, 50),
                  clipPath:
                    'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 15px 100%)',
                },
              },
              [
                ,
                // ADDITIONS
                h(
                  'div',
                  {
                    style: {
                      ...iconBoxStyle,
                      color: $.additions > 0 ? colors.success : undefined,
                    },
                  },
                  [, h(Icon.PlusSquare, iconStyle)]
                ),

                h(
                  'div',
                  {
                    style: {
                      color: $.additions > 0 ? colors.success : undefined,
                      paddingBottom: '1px',
                    },
                  },
                  `${$.additions}`
                ),

                // DELETIONS
                h(
                  'div',
                  {
                    style: {
                      ...iconBoxStyle,
                      marginLeft: '12px',
                      color: $.deletions > 0 ? colors.error : undefined,
                    },
                  },
                  [, h(Icon.MinusSquare, iconStyle)]
                ),

                h(
                  'div',
                  {
                    style: {
                      color: $.deletions > 0 ? colors.error : undefined,
                      paddingBottom: '1px',
                    },
                  },
                  `${$.deletions}`
                ),
              ]
            ),

          // STATUSBAR MESSAGE
          h('div', [
            ,
            h(
              'div',
              {
                style: {
                  marginLeft: '26px',
                  color: cvar('foreground-60'),
                  paddingBottom: '1px',
                },
              },
              $.message
            ),
          ]),
        ]
      ),

      // RIGHT
      h(
        'div',
        {
          style: statusGroupStyle,
        },
        [
          ,
          // STATUSBAR CONTROL MESSAGE
          h('div', [
            ,
            h(
              'div',
              {
                style: {
                  marginRight: '10px',
                  color: cvar('foreground-60'),
                  paddingBottom: '1px',
                },
              },
              $.controlMessage
            ),
          ]),

          $.runningServers.has(api.nvim.state.cwd + $.filetype) &&
            h(
              'div',
              {
                style: itemStyle,
              },
              [, h('div', [, h(Icon.Zap, { color: '#555', ...iconStyle })])]
            ),

          h(
            'div',
            {
              style: {
                ...itemStyle,
                paddingLeft: '30px',
                paddingRight: '30px',
                color: brighten($.baseColor, 10),
                background: darken($.baseColor, 50),
                marginRight: '-15px',
                clipPath:
                  'polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%)',
              },
            },
            [
              ,
              // ERRORS
              h(
                'div',
                {
                  style: {
                    ...iconBoxStyle,
                    color: $.errors > 0 ? colors.error : undefined,
                  },
                },
                [, h(Icon.XCircle, iconStyle)]
              ),

              h(
                'div',
                {
                  style: {
                    color: $.errors > 0 ? colors.error : undefined,
                    paddingBottom: '1px',
                  },
                },
                `${$.errors}`
              ),

              // WARNINGS
              h(
                'div',
                {
                  style: {
                    ...iconBoxStyle,
                    marginLeft: '12px',
                    color: $.warnings > 0 ? colors.warning : undefined,
                  },
                },
                [, h(Icon.AlertTriangle, iconStyle)]
              ),

              h(
                'div',
                {
                  style: {
                    color: $.warnings > 0 ? colors.warning : undefined,
                    paddingBottom: '1px',
                  },
                },
                `${$.warnings}`
              ),
            ]
          ),

          h(
            'div',
            {
              style: {
                ...itemStyle,
                paddingLeft: '30px',
                paddingRight: '30px',
                color: brighten($.baseColor, 60),
                background: darken($.baseColor, 30),
                marginRight: '-15px',
                clipPath:
                  'polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%)',
                paddingBottom: '1px',
              },
            },
            [, h('div', `${$.line + 1}:${$.column + 1}`)]
          ),

          h(
            'div',
            {
              style: {
                display: 'flex',
                height: '100%',
              },
            },
            [
              ,
              $.tabs.map(({ id }, ix) =>
                Tab({
                  id,
                  label: ix + 1,
                  active: $.active === id,
                })
              ),
            ]
          ),
        ]
      ),
    ]
  )

const ui = app<S, typeof actions>({
  name: 'statusline',
  state,
  actions,
  view,
  element: container,
})

api.nvim.watchState.filetype(ui.setFiletype)
api.nvim.watchState.line(ui.setLine)
api.nvim.watchState.column(ui.setColumn)
api.nvim.watchState.cwd((cwd: string) => {
  const next = homedir() === cwd ? getCurrentName() : basename(cwd)
  ui.setCwd(next)
})

sub('tabs', async ({ curtab, tabs }: { curtab: ExtContainer; tabs: Tab[] }) => {
  const mtabs: TabInfo[] = tabs.map((t) => ({ id: t.tab.id, name: t.name }))
  mtabs.length > 1
    ? ui.updateTabs({ active: curtab.id, tabs: mtabs })
    : ui.updateTabs({ active: -1, tabs: [] })
})

api.git.onBranch((branch) => ui.setGitBranch(branch))
api.git.onStatus((status) => ui.setGitStatus(status))
sub('ai.diagnostics.count', (count) => ui.setDiagnostics(count))
sub('ai.start', (opts) => ui.aiStart(opts))
sub('message.status', (msg) => ui.setMessage(msg))
sub('message.control', (msg) => ui.setControlMessage(msg))
onSwitchVim(() => ui.updateTabs({ active: -1, tabs: [] }))

api.nvim.watchState.colorscheme(async () => {
  const { background } = await getColorByName('StatusLine')
  if (background) ui.setColor(background)
})

setImmediate(async () => {
  processAnyBuffered('tabs')
  const { background } = await getColorByName('StatusLine')
  if (background) ui.setColor(background)
})
