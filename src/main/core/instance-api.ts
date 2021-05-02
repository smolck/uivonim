import { VimMode, BufferInfo, HyperspaceCoordinates } from '../neovim/types'
import { onFnCall } from '../../common/utils'
import Worker from '../workers/messaging/worker'
import { BrowserWindow } from 'electron'
// TODO(smolck)
// import { colors } from '../render/highlight-attributes'
import { Functions } from '../neovim/function-types'
import { WindowMetadata } from '../../common/types'
// import * as dispatch from '../messaging/dispatch'

// TODO(smolck)
import { GitStatus } from '../workers/tbd-folder-name/git'
import NeovimState from '../neovim/state'
import { EventEmitter } from 'events'
import { clipboard } from 'electron'

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

  // TODO(smolck): Async? Return promise?
  // this.workerInstanceRef.on.showNeovimMessage(async (...a: any[]) => {}
  workerInstanceRef.on.showNeovimMessage((...a: any[]) => {
    winRef.webContents.send('fromMain', ['nvim.showNeovimMessage', a])
  })

  workerInstanceRef.on.showStatusBarMessage((message: string) => {
    winRef.webContents.send('fromMain', ['nvim.message.status', message])
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

  // TODO(smolck): What to do here . . .
  /*this.workerInstanceRef.on.getDefaultColors(async () => ({
        background: colors.background,
        foreground: colors.foreground,
        special: colors.special,
      }))*/

  workerInstanceRef.on.getCursorPosition(async () => {
    // TODO(smolck): What to do here exactly?
    /*const {
          cursor: { row, col },
        } = require('../core/cursor')
        return { row, col }*/
  })

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

    getBufferInfo(): Promise<BufferInfo> {
      return workerInstanceRef.request.getBufferInfo()
    },

    setMode(mode: VimMode) {
      Object.assign(state, { mode })
      workerInstanceRef.call.setNvimMode(mode)
    },

    async getWindowMetadata(): Promise<WindowMetadata[]> {
      return workerInstanceRef.request.getWindowMetadata()
    },

    onAction(name: string, fn: (...args: any[]) => void) {
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

    gitOnStatus(fn: (status: GitStatus) => void) {
      ee.on('git.status', fn)
    },
    gitOnBranch(fn: (branch: string) => void) {
      ee.on('git.branch', fn)
    },

    bufferSearch(file: string, query: string) {
      return workerInstanceRef.request.bufferSearch(file, query)
    },
    bufferSearchVisible(query: string) {
      return workerInstanceRef.request.bufferSearchVisible(query)
    },

    onNvimLoaded(fn: (switchInstance: boolean) => void) {
      ee.on('nvim.load', fn)
    },

    nvimGetVar(key: string) {
      return workerInstanceRef.request.nvimGetVar(key)
    },

    nvimCommand(command: string) {
      workerInstanceRef.call.nvimCommand(command)
    },

    nvimFeedkeys(keys: string, mode = 'm') {
      workerInstanceRef.call.nvimFeedkeys(keys, mode)
    },

    nvimExpr(expr: string) {
      // TODO(smolck): Return here necessary?
      return workerInstanceRef.request.nvimExpr(expr)
    },

    nvimCall: onFnCall((name, a) =>
      workerInstanceRef.request.nvimCall(name, a)
    ) as Functions,

    nvimJumpTo(coords: HyperspaceCoordinates) {
      workerInstanceRef.call.nvimJumpTo(coords)
    },

    nvimGetKeymap() {
      return workerInstanceRef.request.nvimGetKeymap()
    },

    nvimGetColorByName(name: string) {
      return workerInstanceRef.request.nvimGetColorByName(name)
    },

    async nvimSaveCursor() {
      // TODO(smolck): Is this const necessary?
      const instance = workerInstanceRef
      const pos = await workerInstanceRef.request.nvimSaveCursor()
      return () => instance.call.nvimRestoreCursor(pos)
    },

    async nvimHighlightSearchPattern(
      pattern: string,
      id?: number
    ): Promise<number> {
      return workerInstanceRef.request.nvimHighlightSearchPattern(pattern, id)
    },

    async nvimRemoveHighlightSearch(
      id: number,
      pattern?: string
    ): Promise<boolean> {
      return workerInstanceRef.request.nvimRemoveHighlightSearch(id, pattern)
    },

    onInputRemapModifiersDidChange(fn: (modifiers: any[]) => void) {
      ee.on('input.remap.modifiers', fn)
    },

    onInputKeyTransformsDidChange(fn: (transforms: any[]) => void) {
      ee.on('input.key.transforms', fn)
    },
  }
}

export default InstanceApi
export type InstanceApi = ReturnType<typeof InstanceApi>
