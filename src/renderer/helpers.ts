// TODO(smolck): Better module name?

import { invoke as tauriInvoke } from '@tauri-apps/api/tauri'
import { listen as tauriListen } from '@tauri-apps/api/event'
import { dispatchConstructor } from './dispatch'
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

  getWindowMetadata: 'nvim.instanceApi.getWindowMetadata',
  winGetAndSetSize: 'nvim.winGetAndSetSize',
  nvimResize: 'nvim_resize',
  nvimResizeGrid: 'nvim_resize_grid',
  documentOnInput: 'documentOnInput',
  documentOnKeydown: 'documentOnKeydown',
  inputFocus: 'inputFocus',
  inputBlur: 'inputBlur',
  getColorByName: 'getColorByName',
  getHighlightByName: 'get_highlight_by_name',
  setMode: 'setMode',
  registerOneTimeUseShortcuts: 'registerOneTimeUseShortcuts',
  nvimCmd: 'nvim_command',
  getBufferInfo: 'get_buffer_info',
  nvimJumpTo: 'nvimJumpTo',
  expand: 'expand',
  getDirFiles: 'getDirFiles',
  getDirs: 'getDirs',
} as const

const Events = {
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
  cmdUpdate: 'cmd.update',
  cmdHide: 'cmd.hide',
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
  pmenuHide: 'pmenu.hide',
  pmenuSelect: 'pmenu.select',
  pmenuShow: 'pmenu.show',
  msgShow: 'messages.show',
  msgStatus: 'message.status',
  msgAppend: 'messages.append',
  msgShowHistory: 'messages.showMessageHistory',
  msgControl: 'message.control',
  msgClear: 'messages.clear',
  showCursor: 'showCursor',
  hideCursor: 'hideCursor',
  enableThenShowCursor: 'enableThenShowCursor',
  hideThenDisableCursor: 'hideThenDisableCursor',
  pubRedraw: 'pubRedraw',
  disposeInvalidWinsThenLayout: 'dispose_invalid_wins_then_layout',
  hlAttrDefine: 'hl_attr_define',
  defaultColorsSet: 'default_colors_set',
  optionSet: 'option_set',
  searchUpdate: 'search.update',
  setTitle: 'set_title',
  wildmenuShow: 'wildmenu_show',
  wildmenuHide: 'wildmenu_hide',
  wildmenuSelect: 'wildmenu_select',
}

// @ts-ignore
export const invoke: {
  [Key in keyof typeof Invokables]: (args: any) => Promise<any>
} = new Proxy(Invokables, {
  get: (invokables, key) => (args: any) => tauriInvoke(Reflect.get(invokables, key), args),
})

// @ts-ignore
export const listen: {
  [Key in keyof typeof Events]: (fn: (...args: any[]) => void) => void
} = new Proxy(Events, {
  get: (events, key) => (fn: (...args: any[]) => void) => tauriListen(Reflect.get(events, key), fn),
})

// @ts-ignore
export const listenRedraw: {
  [Key in keyof typeof RedrawEvents]: (fn: (...args: any[]) => void) => void
} = new Proxy(RedrawEvents, {
  get: (events, key) => (fn: (...args: any[]) => void) => tauriListen(Reflect.get(events, key), fn),
})

interface NvimState {
  mode: string,        // TODO(smolck): Make type for this probably?
  buffer_type: string, // TODO(smolck): Same as above ^^^
  current_file: string,
  filetype: string,
  dir: string,
  cwd: string,
  colorscheme: string,
  revision: number,
  line: number,
  column: number,
  editor_top_line: number,
  editor_bottom_line: number,
  absolute_filepath: string,
}

const watchers = dispatchConstructor()
tauriListen('nvim_state', (newState) => watchers.pub('nvim_state', newState))

// @ts-ignore
export const watchNvimState: {
  [Key in keyof NvimState]: (fn: (val: NvimState[Key]) => void) => void
} = new Proxy({}, {
  get: (_, prop) => (fn: (key: keyof NvimState) => void) => watchers.sub('nvim_state', (newState) => fn(newState[prop]))
})