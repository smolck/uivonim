// TODO(smolck): Better module name?

import { invoke as tauriInvoke } from '@tauri-apps/api/tauri'
import { listen as tauriListen } from '@tauri-apps/api/event'
import { dispatchConstructor } from './dispatch'
import { CanvasKit } from 'canvaskit-wasm'

let maybeThisIsntGreatButItllWork: CanvasKit

export const setCanvasKit = (ck: CanvasKit) =>
  (maybeThisIsntGreatButItllWork = ck)

export const canvasKit = () => {
  if (!maybeThisIsntGreatButItllWork)
    throw new Error('NEED TO INITIALIZE CANVAS KIT BEFORE DOING THIS')

  return maybeThisIsntGreatButItllWork
}

// import { listen, emit } from "@tauri-apps/api/event";

/*const InternalInvokables = {
  stealInput: 'stealInput',
  restoreInput: 'restoreInput',
  luaeval: 'luaeval',
  getWorkerInstanceId: 'getWorkerInstanceId',
  setWinTitle: 'setWinTitle',
}*/

/// Defined in src-tauri/src/commands.rs
const Invokables = {
  attachUi: 'attach_ui',
  documentOnInput: 'document_on_input',
  documentOnKeydown: 'document_on_keydown',
  getFontBytes: 'get_font_bytes',

  quit: 'quit',

  getWindowMetadata: 'nvim.instanceApi.getWindowMetadata',
  winGetAndSetSize: 'nvim.winGetAndSetSize',
  nvimResize: 'nvim_resize',
  nvimResizeGrid: 'nvim_resize_grid',
  inputFocus: 'input_focus',
  inputBlur: 'input_blur',
  getColorByName: 'getColorByName',
  getHighlightByName: 'get_highlight_by_name',
  setMode: 'setMode',
  registerOneTimeUseShortcuts: 'register_one_time_use_shortcuts',
  nvimCmd: 'nvim_command',
  getBufferInfo: 'get_buffer_info',
  nvimJumpTo: 'nvimJumpTo',
  expand: 'expand',
  getDirFiles: 'getDirFiles',
  getDirs: 'getDirs',
} as const

const Events = {
  stolenInputKeyListener: 'stolen_input_key_listener',

  shortcut: 'shortcut',

  gitOnStatus: 'gitOnStatus',
  gitOnBranch: 'gitOnBranch',
  invokeHandlersReady: 'invokeHandlersReady',
  homeDir: 'homeDir',
  nvimState: 'nvim.state',
  nvimRedraw: 'nvim.redraw',
  colorschemeStateUpdated: 'nvimState.colorscheme',
  nvimShowMessage: 'nvimShowMessage',
  nvimMessageStatus: 'nvimMessageStatus',
  windowEnterFullScreen: 'window-enter-full-screen',
  windowLeaveFullScreen: 'window-leave-full-screen',
  ncAction: 'ncAction',
  signatureHelpAction: 'signatureHelpAction',
  signatureHelpCloseAction: 'signatureHelpCloseAction',
  buffersAction: 'buffersAction',
  referencesAction: 'referencesAction',
  codeActionAction: 'codeActionAction',
  hoverAction: 'hoverAction',
  hoverCloseAction: 'hoverCloseAction',
  pickColor: 'pickColor',
  modifyColorschemeLive: 'modifyColorschemeLive',
  explorer: 'explorer',
  updateNameplates: 'window.refresh',
  lspDiagnostics: 'lspDiagnostics',
} as const

const RedrawEvents = {
  cmdShow: 'cmdline_show',
  cmdHide: 'cmdline_hide',
  cmdPos: 'cmdline_pos',
  gridLine: 'grid_line',
  gridScroll: 'grid_scroll',
  gridCursorGoto: 'grid_cursor_goto',
  gridResize: 'grid_resize',
  gridClear: 'grid_clear',
  gridDestroy: 'grid_destroy',
  winPos: 'win_pos',
  winFloatPos: 'win_float_pos',
  winClose: 'win_close',
  winHide: 'win_hide',
  tablineUpdate: 'tabline_update',
  modeChange: 'mode_change',
  pmenuHide: 'popupmenu_hide',
  pmenuSelect: 'popupmenu_select',
  pmenuShow: 'popupmenu_show',

  msgShow: 'messages.show',
  msgAppend: 'messages.append',
  msgStatus: 'messages.status',
  msgHistoryShow: 'msg_history_show',
  msgControl: 'messages.control',
  msgClear: 'msg_clear',

  showCursor: 'showCursor',
  hideCursor: 'hideCursor',
  enableThenShowCursor: 'enableThenShowCursor',
  hideThenDisableCursor: 'hideThenDisableCursor',
  pubRedraw: 'pubRedraw',
  disposeInvalidWinsThenLayout: 'dispose_invalid_wins_then_layout',
  hlAttrDefine: 'hl_attr_define',
  defaultColorsSet: 'default_colors_set',
  optionSet: 'option_set',
  setTitle: 'set_title',
  wildmenuShow: 'wildmenu_show',
  wildmenuSelect: 'wildmenu_select',
}

// @ts-ignore
export const invoke: {
  [Key in keyof typeof Invokables]: (args: any) => Promise<any>
} = new Proxy(Invokables, {
  get: (invokables, key) => (args: any) =>
    tauriInvoke(Reflect.get(invokables, key), args),
})

// @ts-ignore
export const listen: {
  [Key in keyof typeof Events]: (fn: (...args: any[]) => void) => void
} = new Proxy(Events, {
  get: (events, key) => (fn: (...args: any[]) => void) =>
    tauriListen(Reflect.get(events, key), fn),
})

// @ts-ignore
export const listenRedraw: {
  [Key in keyof typeof RedrawEvents]: (fn: (...args: any[]) => void) => void
} = new Proxy(RedrawEvents, {
  get: (events, key) => (fn: (...args: any[]) => void) =>
    tauriListen(Reflect.get(events, key), fn),
})

interface NvimState {
  mode: string // TODO(smolck): Make type for this probably?
  buffer_type: string // TODO(smolck): Same as above ^^^
  current_file: string
  filetype: string
  dir: string
  cwd: string
  colorscheme: string
  revision: number
  line: number
  column: number
  editor_top_line: number
  editor_bottom_line: number
  absolute_filepath: string
}

const watchers = dispatchConstructor()
tauriListen('nvim_state', (newState) => watchers.pub('nvim_state', newState))

// @ts-ignore
export const watchNvimState: {
  [Key in keyof NvimState]: (fn: (val: NvimState[Key]) => void) => void
} = new Proxy(
  {},
  {
    get: (_, prop) => (fn: (key: keyof NvimState) => void) =>
      watchers.sub('nvim_state', (newState) => fn(newState[prop])),
  }
)

const shorts = new Map()
export const registerOneTimeUseShortcuts = (
  shortcuts: string[],
  cb: (shortcut: string) => void
) => {
  // @ts-ignore
  shortcuts.forEach((shortcut) => shorts.set(shortcut, cb))
  invoke.registerOneTimeUseShortcuts({ shortcuts })
}

listen.shortcut(({ payload: shortcut }) => {
  const maybeCb = shorts.get(shortcut)
  if (maybeCb) {
    maybeCb(shortcut)
    shorts.delete(shortcut)
  } else {
    console.error(
      `umm this shouldnt happen, why is there no shortcut '${shortcut}'`,
      shorts
    )
  }
})