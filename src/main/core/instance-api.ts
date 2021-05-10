import { VimMode, HyperspaceCoordinates } from '../neovim/types'
import { BufferInfo } from '../../common/types'
import { onFnCall } from '../../common/utils'
import { Worker } from '../workers/messaging/worker'
import { BrowserWindow } from 'electron'
import { Functions } from '../neovim/function-types'
import { WindowMetadata } from '../../common/types'
import { GitStatus } from '../workers/git'
import NeovimState from '../neovim/state'
import { EventEmitter } from 'events'
import { clipboard } from 'electron'
import { Events } from '../../common/ipc'

const InstanceApi = (workerInstanceRef: Worker, winRef: BrowserWindow) => {
  const ee = new EventEmitter()
  const {
    state,
    watchState,
    onStateValue,
    onStateChange,
    untilStateValue,
  } = NeovimState('nvim-mirror')

  const actionRegistrations: string[] = []
  if (actionRegistrations.length)
    actionRegistrations.forEach((name) => workerInstanceRef.call.onAction(name))
  workerInstanceRef.on.nvimStateUpdate((stateDiff: any) => {
    // TODO: do we need this to always be updated or can we query these values?
    // this will trigger on every cursor move and take up time in the render cycle
    Object.assign(state, stateDiff)
  })

  // TODO(smolck): Used to return promise here, probably fine now but just a
  // note.
  workerInstanceRef.on.showNeovimMessage((...a: any[]) =>
    winRef.webContents.send(Events.nvimShowMessage, a)
  )

  workerInstanceRef.on.showStatusBarMessage((message: string) => {
    winRef.webContents.send(Events.nvimMessageStatus, message)
  })

  workerInstanceRef.on.vimrcLoaded(() => ee.emit('nvim.load', false))
  workerInstanceRef.on.gitStatus((status: GitStatus) =>
    ee.emit('git.status', status)
  )
  workerInstanceRef.on.gitBranch((branch: string) =>
    ee.emit('git.branch', branch)
  )
  workerInstanceRef.on.actionCalled((name: string, args: any[]) =>
    ee.emit(`action.${name}`, ...args)
  )

  workerInstanceRef.on.clipboardRead(async () => clipboard.readText())
  workerInstanceRef.on.clipboardWrite((text: string) =>
    clipboard.writeText(text)
  )

  return {
    state,
    watchState,
    onStateValue,
    onStateChange,
    untilStateValue,

    getBufferInfo: (): Promise<BufferInfo> =>
      workerInstanceRef.request.getBufferInfo(),

    setMode: (mode: VimMode) => {
      Object.assign(state, { mode })
      workerInstanceRef.call.setNvimMode(mode)
    },

    getWindowMetadata: (): Promise<WindowMetadata[]> => {
      return workerInstanceRef.request.getWindowMetadata()
    },

    onAction: (name: string, fn: (...args: any[]) => void) => {
      if (typeof fn !== 'function')
        throw new Error(`nvim.onAction needs a function for event ${name}`)

      actionRegistrations.push(name)
      ee.on(`action.${name}`, fn)

      try {
        workerInstanceRef.call.onAction(name)
      } catch (_) {
        // not worried if no instance, we will register later in 'onCreateVim'
      }
    },

    gitOnStatus: (fn: (status: GitStatus) => void) => ee.on('git.status', fn),
    gitOnBranch: (fn: (branch: string) => void) => ee.on('git.branch', fn),

    bufferSearch: (file: string, query: string) =>
      workerInstanceRef.request.bufferSearch(file, query),
    bufferSearchVisible: (query: string) =>
      workerInstanceRef.request.bufferSearchVisible(query),

    onNvimLoaded: (fn: (switchInstance: boolean) => void) =>
      ee.on('nvim.load', fn),

    nvimGetVar: (key: string) => workerInstanceRef.request.nvimGetVar(key),

    nvimCommand: (command: string) =>
      workerInstanceRef.call.nvimCommand(command),

    nvimFeedkeys: (keys: string, mode = 'm') =>
      workerInstanceRef.call.nvimFeedkeys(keys, mode),

    nvimExpr: (expr: string) => workerInstanceRef.request.nvimExpr(expr),

    nvimCall: onFnCall((name, a) =>
      workerInstanceRef.request.nvimCall(name, a)
    ) as Functions,

    nvimJumpTo: (coords: HyperspaceCoordinates) =>
      workerInstanceRef.call.nvimJumpTo(coords),

    nvimGetKeymap: () => workerInstanceRef.request.nvimGetKeymap(),

    nvimGetColorByName: (name: string) =>
      workerInstanceRef.request.nvimGetColorByName(name),

    nvimSaveCursor: async () => {
      const instance = workerInstanceRef
      const pos = await workerInstanceRef.request.nvimSaveCursor()
      return () => instance.call.nvimRestoreCursor(pos)
    },

    getHighlightByName: (
      name: string,
      isRgb?: boolean
    ): Promise<{
      foreground?: number
      background?: number
      reverse?: boolean
    }> => workerInstanceRef.request.nvimGetHighlightByName(name, isRgb),

    nvimHighlightSearchPattern: (
      pattern: string,
      id?: number
    ): Promise<number> =>
      workerInstanceRef.request.nvimHighlightSearchPattern(pattern, id),

    nvimRemoveHighlightSearch: (
      id: number,
      pattern?: string
    ): Promise<boolean> =>
      workerInstanceRef.request.nvimRemoveHighlightSearch(id, pattern),

    onInputRemapModifiersDidChange: (fn: (modifiers: any[]) => void) =>
      ee.on('input.remap.modifiers', fn),

    onInputKeyTransformsDidChange: (fn: (transforms: any[]) => void) =>
      ee.on('input.key.transforms', fn),

    nvimOption: (opt: string): Promise<any> =>
      workerInstanceRef.request.nvimOption(opt),
  }
}

export default InstanceApi
export type InstanceApi = ReturnType<typeof InstanceApi>
