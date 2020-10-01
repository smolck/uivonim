export enum InventoryLayerKind {
  Jump = 'Jump',
  Debug = 'Debug',
  Buffer = 'Buffer',
  Search = 'Search',
  Window = 'Window',
  Project = 'Project',
  Language = 'Language',
  Instance = 'Instance',
  /** Only available in Veonim DEV builds */
  DEV = 'LOLHAX',
}

export interface InventoryLayer {
  /** Layer name. Will be formatted and used for Vim command. */
  kind: InventoryLayerKind
  /** Key binding to activate this action */
  keybind: string
  /** User friendly description provided in the UI */
  description: string
  /** This layer is only available DEV builds. Default: FALSE */
  devOnly?: boolean
}

// TODO: specify order or order these in desired display order?
export default [
  {
    kind: InventoryLayerKind.Language,
    keybind: 'l',
    description: 'Language server features',
  },
  {
    kind: InventoryLayerKind.Debug,
    keybind: 'd',
    description: 'Debug your bugs',
  },
  {
    kind: InventoryLayerKind.Search,
    keybind: 's',
    description: 'Grep, Viewport, .etc',
  },
  {
    kind: InventoryLayerKind.Jump,
    keybind: 'j',
    description: 'Access jump shortcuts',
  },
  {
    kind: InventoryLayerKind.Buffer,
    keybind: 'b',
    description: 'List and jump between buffers',
  },
  {
    kind: InventoryLayerKind.Window,
    keybind: 'w',
    description: 'Resize, split, and swap windows',
  },
  {
    kind: InventoryLayerKind.Project,
    keybind: 'p',
    description: 'Project management',
  },
  {
    kind: InventoryLayerKind.Instance,
    keybind: 'i',
    description: 'Control multiple Neovim instances',
  },
  {
    kind: InventoryLayerKind.DEV,
    keybind: "'",
    description: 'if ur seein dis ur an ub3r 1337 h4x0rz',
    devOnly: true,
  },
] as InventoryLayer[]
