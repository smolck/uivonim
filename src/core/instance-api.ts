import { getWorkerInstance } from '../core/master-control'
import { VimMode, BufferInfo, HyperspaceCoordinates } from '../neovim/types'
import { onFnCall, pascalCase } from '../support/utils'
import { colors } from '../render/highlight-attributes'
import { Functions } from '../neovim/function-types'
import { WindowMetadata } from '../windows/metadata'
import * as dispatch from '../messaging/dispatch'
import { GitStatus } from '../support/git'
import NeovimState from '../neovim/state'
import { EventEmitter } from 'events'
import { clipboard } from 'electron'

const ee = new EventEmitter()
const {
  state,
  watchState,
  onStateValue,
  onStateChange,
  untilStateValue,
} = NeovimState('nvim-mirror')

const actionRegistrations: string[] = []
export const setupNvimOnHandlers = () => {
  const workerInstance = getWorkerInstance()
  if (actionRegistrations.length)
    actionRegistrations.forEach((name) => workerInstance.call.onAction(name))

  workerInstance.on.nvimStateUpdate((stateDiff: any) => {
    // TODO: do we need this to always be updated or can we query these values?
    // this will trigger on every cursor move and take up time in the render cycle
    Object.assign(state, stateDiff)
  })

  workerInstance.on.showNeovimMessage(async (...a: any[]) => {
    const msg = require('../components/nvim/messages').default.show(...a)
    return msg.promise
  })
  workerInstance.on.showStatusBarMessage((message: string) => {
    dispatch.pub('message.status', message)
  })
  workerInstance.on.vimrcLoaded(() => ee.emit('nvim.load', false))
  workerInstance.on.gitStatus((status: GitStatus) =>
    ee.emit('git.status', status)
  )
  workerInstance.on.gitBranch((branch: string) => ee.emit('git.branch', branch))
  workerInstance.on.actionCalled((name: string, args: any[]) =>
    ee.emit(`action.${name}`, ...args)
  )
  workerInstance.on.ai((namespace: string, method: string, args: any[]) => {
    ee.emit(`ai.${namespace}.on${pascalCase(method)}`, ...args)
  })

  workerInstance.on.getDefaultColors(async () => ({
    background: colors.background,
    foreground: colors.foreground,
    special: colors.special,
  }))

  workerInstance.on.getCursorPosition(async () => {
    const {
      cursor: { row, col },
    } = require('../core/cursor')
    return { row, col }
  })

  workerInstance.on.clipboardRead(async () => clipboard.readText())
  workerInstance.on.clipboardWrite((text: string) => clipboard.writeText(text))
}

const getBufferInfo = (): Promise<BufferInfo[]> =>
  getWorkerInstance().request.getBufferInfo()

const setMode = (mode: VimMode) => {
  Object.assign(state, { mode })
  getWorkerInstance().call.setNvimMode(mode)
}

const getWindowMetadata = async (): Promise<WindowMetadata[]> => {
  return getWorkerInstance().request.getWindowMetadata()
}

const onAction = (name: string, fn: (...args: any[]) => void) => {
  if (typeof fn !== 'function')
    throw new Error(`nvim.onAction needs a function for event ${name}`)
  actionRegistrations.push(name)
  ee.on(`action.${name}`, fn)
  try {
    getWorkerInstance().call.onAction(name)
  } catch (_) {
    // not worried if no instance, we will register later in 'onCreateVim'
  }
}

const git = {
  onStatus: (fn: (status: GitStatus) => void) => ee.on('git.status', fn),
  onBranch: (fn: (branch: string) => void) => ee.on('git.branch', fn),
}

const bufferSearch = (file: string, query: string) =>
  getWorkerInstance().request.bufferSearch(file, query)
const bufferSearchVisible = (query: string) =>
  getWorkerInstance().request.bufferSearchVisible(query)

const nvimLoaded = (fn: (switchInstance: boolean) => void) =>
  ee.on('nvim.load', fn)
const nvimGetVar = (key: string) => getWorkerInstance().request.nvimGetVar(key)
const nvimCommand = (command: string) =>
  getWorkerInstance().call.nvimCommand(command)
const nvimFeedkeys = (keys: string, mode = 'm') =>
  getWorkerInstance().call.nvimFeedkeys(keys, mode)
const nvimExpr = (expr: string) => getWorkerInstance().request.nvimExpr(expr)
const nvimCall: Functions = onFnCall((name, a) =>
  getWorkerInstance().request.nvimCall(name, a)
)
const nvimJumpTo = (coords: HyperspaceCoordinates) =>
  getWorkerInstance().call.nvimJumpTo(coords)
const nvimGetKeymap = () => getWorkerInstance().request.nvimGetKeymap()
const nvimGetColorByName = (name: string) =>
  getWorkerInstance().request.nvimGetColorByName(name)
const nvimSaveCursor = async () => {
  const instance = getWorkerInstance()
  const position = await instance.request.nvimSaveCursor()
  return () => instance.call.nvimRestoreCursor(position)
}

const nvimHighlightSearchPattern = async (
  pattern: string,
  id?: number
): Promise<number> => {
  return getWorkerInstance().request.nvimHighlightSearchPattern(pattern, id)
}

const nvimRemoveHighlightSearch = async (
  id: number,
  pattern?: string
): Promise<boolean> => {
  return getWorkerInstance().request.nvimRemoveHighlightSearch(id, pattern)
}

const onConfig = {
  inputRemapModifiersDidChange: (fn: (modifiers: any[]) => void) =>
    ee.on('input.remap.modifiers', fn),
  inputKeyTransformsDidChange: (fn: (transforms: any[]) => void) =>
    ee.on('input.key.transforms', fn),
}

const api = {
  git,
  onAction,
  onConfig,
  getWindowMetadata,
  bufferSearch,
  bufferSearchVisible,
  nvim: {
    state,
    setMode,
    watchState,
    onStateValue,
    getBufferInfo,
    onStateChange,
    call: nvimCall,
    expr: nvimExpr,
    untilStateValue,
    cmd: nvimCommand,
    getVar: nvimGetVar,
    jumpTo: nvimJumpTo,
    onLoad: nvimLoaded,
    feedkeys: nvimFeedkeys,
    getKeymap: nvimGetKeymap,
    saveCursor: nvimSaveCursor,
    getColorByName: nvimGetColorByName,
    removeHighlightSearch: nvimRemoveHighlightSearch,
    highlightSearchPattern: nvimHighlightSearchPattern,
  },
}

export default api
