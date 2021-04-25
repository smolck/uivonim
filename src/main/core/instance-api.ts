// import { getWorkerInstance } from '../core/master-control'
import { VimMode, BufferInfo, HyperspaceCoordinates } from '../neovim/types'
import { onFnCall } from '../../common/utils'
import Worker from '../messaging/worker'
import { BrowserWindow } from 'electron'
// TODO(smolck)
// import { colors } from '../render/highlight-attributes'
import { Functions } from '../neovim/function-types'
// TODO(smolck): Don't import stuff from renderer/ in main/ probably, even if it
// is just types like here.
import { WindowMetadata } from '../../renderer/windows/metadata'
// import * as dispatch from '../messaging/dispatch'
import { GitStatus } from '../../common/git'
import NeovimState from '../neovim/state'
import { EventEmitter } from 'events'
import { clipboard } from 'electron'

export default class {
  private actionRegistrations: string[]
  private ee: EventEmitter
  private _nvimState: NeovimState
  private workerInstanceRef: Worker
  // TODO(smolck): Just keep ref to `winRef.webContents.send`?
  private winRef: BrowserWindow

  get nvimState() {
    return this._nvimState
  }

  constructor(workerInstanceRef: Worker, winRef: BrowserWindow) {
    this.ee = new EventEmitter()
    this._nvimState = new NeovimState('nvim-mirror')
    this.actionRegistrations = []
    this.workerInstanceRef = workerInstanceRef
    this.winRef = winRef
  }

  setupNvimOnHandlers() {
    if (this.actionRegistrations.length)
      this.actionRegistrations.forEach((name) => this.workerInstanceRef.call.onAction(name))
    this.workerInstanceRef.on.nvimStateUpdate((stateDiff: any) => {
      // TODO: do we need this to always be updated or can we query these values?
      // this will trigger on every cursor move and take up time in the render cycle
      Object.assign(this._nvimState, stateDiff)
    })

    // TODO(smolck): Async? Return promise?
    // this.workerInstanceRef.on.showNeovimMessage(async (...a: any[]) => {
    this.workerInstanceRef.on.showNeovimMessage((...a: any[]) => {
      this.winRef.webContents.send('fromMain', ['nvim.showNeovimMessage', a])
    })

    this.workerInstanceRef.on.showStatusBarMessage((message: string) => {
      this.winRef.webContents.send('fromMain', ['nvim.message.status', message])
    })

    this.workerInstanceRef.on.vimrcLoaded(() => this.ee.emit('nvim.load', false))
    this.workerInstanceRef.on.gitStatus((status: GitStatus) =>
      this.ee.emit('git.status', status)
    )
    this.workerInstanceRef.on.gitBranch((branch: string) => this.ee.emit('git.branch', branch))
    this.workerInstanceRef.on.actionCalled((name: string, args: any[]) =>
      this.ee.emit(`action.${name}`, ...args)
    )

    // TODO(smolck): What to do here . . .
    /*this.workerInstanceRef.on.getDefaultColors(async () => ({
      background: colors.background,
      foreground: colors.foreground,
      special: colors.special,
    }))*/

    this.workerInstanceRef.on.getCursorPosition(async () => {
      // TODO(smolck): What to do here exactly?

      /*const {
        cursor: { row, col },
      } = require('../core/cursor')
      return { row, col }*/
    })

    this.workerInstanceRef.on.clipboardRead(async () => clipboard.readText())
    this.workerInstanceRef.on.clipboardWrite((text: string) => clipboard.writeText(text))
  }

  getBufferInfo(): Promise<BufferInfo> {
    return this.workerInstanceRef.request.getBufferInfo()
  }

  setMode(mode: VimMode) {
    Object.assign(this._nvimState, { mode })
    this.workerInstanceRef.call.setNvimMode(mode)
  }

  async getWindowMetadata(): Promise<WindowMetadata[]> {
    return this.workerInstanceRef.request.getWindowMetadata()
  }

  onAction(name: string, fn: (...args: any[]) => void) {
    if (typeof fn !== 'function')
      throw new Error(`nvim.onAction needs a function for event ${name}`)

    this.actionRegistrations.push(name)
    this.ee.on(`action.${name}`, fn)

    try {
      this.workerInstanceRef.call.onAction(name)
    } catch (_) {
    // not worried if no instance, we will register later in 'onCreateVim'
    }
  }

  gitOnStatus(fn: (status: GitStatus) => void) { this.ee.on('git.status', fn) }
  gitOnBranch(fn: (branch: string) => void) { this.ee.on('git.branch', fn) }

  bufferSearch(file: string, query: string) {
    return this.workerInstanceRef.request.bufferSearch(file, query)
  }

  bufferSearchVisible(query: string) {
    return this.workerInstanceRef.request.bufferSearchVisible(query)
  }

  onNvimLoaded(fn: (switchInstance: boolean) => void) {
    this.ee.on('nvim.load', fn)
  }

  nvimGetVar(key: string) {
    return this.workerInstanceRef.request.nvimGetVar(key)
  }

  nvimCommand(command: string) {
    this.workerInstanceRef.call.nvimCommand(command)
  }

  nvimFeedkeys(keys: string, mode = 'm') {
    this.workerInstanceRef.call.nvimFeedkeys(keys, mode)
  }

  nvimExpr(expr: string) {
    // TODO(smolck): Return here necessary?
    return this.workerInstanceRef.request.nvimExpr(expr)
  }

  nvimCall: Functions = onFnCall((name, a) => this.workerInstanceRef.request.nvimCall(name, a))

  nvimJumpTo(coords: HyperspaceCoordinates) {
    this.workerInstanceRef.call.nvimJumpTo(coords)
  }

  nvimGetKeymap() {
    return this.workerInstanceRef.request.nvimGetKeymap()
  }

  nvimGetColorByName(name: string) {
    return this.workerInstanceRef.request.nvimGetColorByName(name)
  }

  async nvimSaveCursor() {
    // TODO(smolck): Is this const necessary?
    const instance = this.workerInstanceRef
    const pos = await this.workerInstanceRef.request.nvimSaveCursor()
    return () => instance.call.nvimRestoreCursor(pos) 
  }

  async nvimHighlightSearchPattern(pattern: string, id?: number): Promise<number> {
    return this.workerInstanceRef.request.nvimHighlightSearchPattern(pattern, id)
  }

  async nvimRemoveHighlightSearch(id: number, pattern?: string): Promise<boolean> {
    return this.workerInstanceRef.request.nvimRemoveHighlightSearch(id, pattern)
  }

  onInputRemapModifiersDidChange(fn: (modifiers: any[]) => void) {
    this.ee.on('input.remap.modifiers', fn)
  }

  onInputKeyTransformsDidChange(fn: (transforms: any[]) => void) {
    this.ee.on('input.key.transforms', fn)
  }
}
