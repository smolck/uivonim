import { InventoryLayerKind } from '../inventory/layers'
// import api from '../core/instance-api'

export interface InventoryAction {
  /** Which layer this action belongs to */
  layer: InventoryLayerKind
  /** Key binding to activate this action */
  keybind: string
  /** Action name. Will be formatted and appended to layer name. Final command value would be :Veonim ${layer}-${command}*/
  name: string
  /** User friendly description provided in the UI */
  description: string
  /** Callback will be executed when this action is selected */
  onAction: () => any
  /** Indicate to the user that this action is experimental. Default: FALSE */
  experimental?: boolean
  /** Hide this action from the inventory menu. Otherwise will show up in the inventory search menu. Default: FALSE */
  hidden?: boolean
}

const mod = (modulePath: string, func = 'default') => {
  try {
    if (process.env.VEONIM_DEV) {
      console.log('NYI: ACTIONS REQUIRE MODULE:', modulePath, func)
    }
    return () => {}
    // return require(`../${modulePath}`)[func]
  } catch (e) {
    console.error(
      'trying to call veonim layer action with a bad modulePath. you probably mistyped the module path\n',
      e
    )
    return () => {}
  }
}

const modc = (modulePath: string, func = 'default') =>
  mod(`components/${modulePath}`, func)
const moda = (modulePath: string, func = 'default') =>
  mod(`ai/${modulePath}`, func)

// TODO: allow actions to be registered as 'hidden'. these will not be displayed
// in the UI as options, but can be found in the fuzzy search menu. useful for
// some less common actions
const actions: InventoryAction[] = [
  {
    layer: InventoryLayerKind.Project,
    keybind: 'f',
    name: 'Files',
    description: 'Find files in project',
    // TODO: should we do something like this instead?
    // onAction: () => import('../components/files').then(m => m.show())
    onAction: modc('files'),
  },
  {
    layer: InventoryLayerKind.Project,
    keybind: 's',
    name: 'Spawn Instance',
    description: 'Spawn Neovim instance with project',
    onAction: modc('change-project', 'createInstanceWithDir'),
  },
  {
    layer: InventoryLayerKind.Instance,
    keybind: 'p',
    name: 'Create Project',
    description: 'Create Neovim instance with project',
    onAction: modc('change-project', 'createInstanceWithDir'),
  },
  {
    layer: InventoryLayerKind.Project,
    keybind: 'c',
    name: 'Change',
    description: 'Change project directory',
    onAction: modc('change-project', 'changeDir'),
  },
  {
    layer: InventoryLayerKind.Search,
    keybind: 'v',
    name: 'Viewport',
    description: 'Search visible viewport',
    onAction: modc('viewport-search'),
  },
  {
    layer: InventoryLayerKind.Instance,
    keybind: 's',
    name: 'Switch',
    description: 'Switch to another Neovim instance',
    onAction: modc('vim-switch'),
  },
  {
    layer: InventoryLayerKind.Instance,
    keybind: 'c',
    name: 'Create',
    description: 'Create new Neovim instance',
    onAction: modc('vim-create'),
  },
  {
    layer: InventoryLayerKind.Search,
    keybind: 'r',
    name: 'Resume Find All',
    description: 'Resume previous find all query',
    onAction: modc('grep', 'grepResume'),
  },
  {
    layer: InventoryLayerKind.Search,
    keybind: 'w',
    name: 'Word All Files',
    description: 'Find current word in all files',
    onAction: modc('grep', 'grepWord'),
  },
  {
    layer: InventoryLayerKind.Search,
    keybind: 'f',
    name: 'All Files',
    description: 'Find in all workspace files',
    onAction: modc('grep', 'grep'),
  },
  {
    layer: InventoryLayerKind.Buffer,
    keybind: 'l',
    name: 'List',
    description: 'Switch to buffer from list',
    onAction: modc('buffers'),
  },
  {
    layer: InventoryLayerKind.Jump,
    keybind: 's',
    name: 'Search',
    description: 'Jump to a Vim search result',
    onAction: modc('divination', 'divinationSearch'),
    experimental: true,
  },
  {
    layer: InventoryLayerKind.Jump,
    keybind: 'l',
    name: 'Line',
    description: 'Jump to a line',
    onAction: modc('divination', 'divinationLine'),
    experimental: true,
  },
  {
    layer: InventoryLayerKind.Debug,
    keybind: 'f',
    name: 'Function Breakpoint',
    description: 'Toggle function breakpoint at line',
    onAction: moda('debug', 'toggleFunctionBreakpoint'),
  },
  {
    layer: InventoryLayerKind.Debug,
    keybind: 'b',
    name: 'Breakpoint',
    description: 'Toggle breakpoint at current line',
    onAction: moda('debug', 'toggleBreakpoint'),
  },
  {
    layer: InventoryLayerKind.Debug,
    keybind: 'c',
    name: 'Continue',
    description: 'Continue debugger',
    onAction: moda('debug', 'continuee'),
  },
  {
    layer: InventoryLayerKind.Debug,
    keybind: 'n',
    name: 'Next',
    description: 'Debugger step next',
    onAction: moda('debug', 'next'),
  },
  {
    layer: InventoryLayerKind.Debug,
    keybind: 't',
    name: 'Stop Debugging',
    description: 'Stop current debug session',
    onAction: moda('debug', 'stop'),
  },
  {
    layer: InventoryLayerKind.Debug,
    keybind: 's',
    name: 'Start Debugging',
    description: 'Start a debug session',
    onAction: moda('debug', 'start'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'd',
    name: 'Definition',
    description: 'Go to symbol definition',
    onAction: moda('definition'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'p',
    name: 'Show Problem',
    description: 'Show problem info at cursor',
    onAction: moda('diagnostics', 'showProblem'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'o',
    name: 'Open Problems',
    description: 'Open problems window',
    onAction: moda('diagnostics', 'openProblems'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'c',
    name: 'Code Action',
    description: 'Fix or refactor code',
    onAction: moda('diagnostics', 'showCodeActions'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'l',
    name: 'Highlight',
    description: 'Highlight symbol',
    onAction: moda('highlights', 'highlight'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'h',
    name: 'Hover',
    description: 'Show symbol information',
    onAction: moda('hover'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'f',
    name: 'References',
    description: 'List symbol references',
    onAction: moda('references', 'showReferences'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'r',
    name: 'Rename',
    description: 'Rename symbol at cursor',
    onAction: moda('rename'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 's',
    name: 'Symbols',
    description: 'List symbols for current file',
    onAction: moda('symbols', 'showSymbols'),
  },
  {
    layer: InventoryLayerKind.Language,
    keybind: 'w',
    name: 'Workspace Symbols',
    description: 'List symbols for all files',
    onAction: moda('symbols', 'showWorkspaceSymbols'),
  },
]

// TODO: we are not ready for this greatness just yet
// actions.forEach(action => {
//   const name = `${action.layer.toLowerCase()}-${action.name.toLowerCase()}`
//   api.onAction(name, action.onAction)
// })

export default {
  list: () => actions,
  getActionsForLayer: (layerKind: InventoryLayerKind) =>
    actions.filter((m) => m.layer === layerKind),
}
