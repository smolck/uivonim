import { WindowMetadata, InputType } from './types'
import { NeovimState } from '../main/neovim/state'

export const InternalInvokables = {
  stealInput: 'stealInput',
  restoreInput: 'restoreInput',
  luaeval: 'luaeval',
  getWorkerInstanceId: 'getWorkerInstanceId',
  setWinTitle: 'setWinTitle',
}

export const Invokables = {
  getWindowMetadata: 'nvim.instanceApi.getWindowMetadata',
  winGetAndSetSize: 'nvim.winGetAndSetSize',
  nvimResize: 'nvim.resize',
  nvimResizeGrid: 'nvim.resizeGrid',
  documentOnInput: 'documentOnInput',
  documentOnKeydown: 'documentOnKeydown',
  inputFocus: 'inputFocus',
  inputBlur: 'inputBlur',
  getColorByName: 'getColorByName',
  getHighlightByName: 'getHighlightByName',
  setMode: 'setMode',
  registerOneTimeUseShortcuts: 'registerOneTimeUseShortcuts',
  nvimCmd: 'nvimCmd',
  getBufferInfo: 'getBufferInfo',
  nvimJumpTo: 'nvimJumpTo',
  expand: 'nvim.call.expand',
  getDirFiles: 'getDirFiles',
  getDirs: 'getDirs',
} as const

export const Events = {
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
} as const

export interface WindowApi {
  isMacos: boolean
  homeDir: string
  setWinTitle: (newTitle: string) => void
  luaeval: (...args: any[]) => void
  stealInput: (
    fn:
      | (() => void)
      | ((inputKeys: string) => void)
      | ((inputKeys: string, inputType: InputType) => void)
  ) => void
  restoreInput: () => Promise<void>
  gitOnBranch: (fn: (branch: any) => void) => void
  gitOnStatus: (fn: (status: any) => void) => void
  on: (
    event: typeof Events[keyof typeof Events],
    func: (...args: any[]) => void
  ) => void
  nvimWatchState: (key: string, fn: (stateThing: any) => void) => void
  nvimState: () => NeovimState
  getWindowMetadata: () => Promise<WindowMetadata[]>
  invoke: (
    invokable: typeof Invokables[keyof typeof Invokables],
    ...args: any[]
  ) => Promise<any>
}

declare global {
  interface Window {
    api: WindowApi
  }
}
