import { WindowMetadata, InputType } from './types'

export const InternalInvokables = {
  nvimWatchState: 'nvim.watchState',
  gitOnStatus: 'gitOnStatus',
  gitOnBranch: 'gitOnBranch',
  stealInput: 'stealInput',
  restoreInput: 'restoreInput',
  luaeval: 'luaeval',
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
} as const

export const Events = {
  nvimState: 'nvim.state',
  nvimRedraw: 'nvim.redraw',
  colorschemeStateUpdated: 'nvimState.colorscheme',
  nvimShowMessage: 'nvimShowMessage',
  nvimMessageStatus: 'nvimMessageStatus',
  workerInstanceId: 'workerInstanceId',
  windowEnterFullScreen: 'window-enter-full-screen',
  windowLeaveFullScreen: 'window-leave-full-screen',
  // TODO(smolck): setVar: 'setVar',
  
  ncAction: 'nyAction',
  signatureHelpAction: 'signatureHelpAction',
  signatureHelpCloseAction: 'signatureHelpCloseAction',
  buffersAction: 'buffersAction',
  referencesAction: 'referencesAction',
  codeActionAction: 'codeActionAction',
} as const

export interface WindowApi {
  luaeval: (...args: any[]) => void,
  stealInput: (fn: ((() => void) | ((inputKeys: string) => void) | ((inputKeys: string, inputType: InputType) => void))) => void,
  restoreInput: () => void,
  gitOnBranch: (fn: (branch: any) => void) => void,
  gitOnStatus: (fn: (status: any) => void) => void,
  on: (
    event: typeof Events[keyof typeof Events],
    func: (...args: any[]) => void
  ) => void
  // TODO(smolck): Type here?
  nvimWatchState: any,
  nvimState: {
    // TODO(smolck)
    state: () => any
  }
  workerInstanceId: () => number
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