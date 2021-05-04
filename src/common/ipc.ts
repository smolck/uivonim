import { WindowMetadata, InputType } from './types'

export const InternalInvokables = {
  nvimWatchState: 'nvim.watchState',
  gitOnStatus: 'gitOnStatus',
  gitOnBranch: 'gitOnBranch',
  stealInput: 'stealInput',
  restoreInput: 'restoreInput',
  luaeval: 'luaeval',
  getWorkerInstanceId: 'getWorkerInstanceId',
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
  homeDir: 'homeDir',
  nvimState: 'nvim.state',
  nvimRedraw: 'nvim.redraw',
  colorschemeStateUpdated: 'nvimState.colorscheme',
  nvimShowMessage: 'nvimShowMessage',
  nvimMessageStatus: 'nvimMessageStatus',
  windowEnterFullScreen: 'window-enter-full-screen',
  windowLeaveFullScreen: 'window-leave-full-screen',
  // TODO(smolck): setVar: 'setVar',

  // TODO(smolck): Why did I put `action` on the end of all of this . . .
  ncAction: 'nyAction',
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
} as const

export interface WindowApi {
  homeDir: string,
  luaeval: (...args: any[]) => void
  stealInput: (
    fn:
      | (() => void)
      | ((inputKeys: string) => void)
      | ((inputKeys: string, inputType: InputType) => void)
  ) => void
  restoreInput: () => void
  gitOnBranch: (fn: (branch: any) => void) => void
  gitOnStatus: (fn: (status: any) => void) => void
  on: (
    event: typeof Events[keyof typeof Events],
    func: (...args: any[]) => void
  ) => void
  // TODO(smolck): Type here?
  nvimWatchState: any
  nvimState: {
    // TODO(smolck)
    state: () => any
  }
  getWindowMetadata: () => Promise<WindowMetadata[]>
  invoke: (
    invokable: typeof Invokables[keyof typeof Invokables],
    ...args: any[]
  ) => Promise<any>
}

// TODO(smolck): Make sure this all works
declare global {
  interface Window {
    api: WindowApi
  }
}
