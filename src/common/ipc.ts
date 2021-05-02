import { WindowMetadata } from './types'

export const InternalInvokables = {
  nvimWatchStateFile: 'nvim.watchState.file',
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
} as const

export interface WindowApi {
  // send: (channel: string, data: any) => void,
  // receive: (channel: string, func: (args: any[]) => void) => void
  // call: (funcName: string, ...args: any[]) => void,
  on: (
    event: typeof Events[keyof typeof Events],
    func: (...args: any[]) => void
  ) => void
  nvimWatchStateFile: (fn: (file: string) => void) => void
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
