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
  private _actionRegistrations: string[]
  private _ee: EventEmitter
  private _nvimState: NeovimState
  private _workerInstanceRef: Worker
  // TODO(smolck): Just keep ref to `winRef.webContents.send`?
  private _winRef: BrowserWindow

  get nvimState() {
    return this._nvimState
  }

  constructor(workerInstanceRef: Worker, winRef: BrowserWindow) {
    this._ee = new EventEmitter()
    this._nvimState = new NeovimState('nvim-mirror')
    this._actionRegistrations = []
    this._workerInstanceRef = workerInstanceRef
    this._winRef = winRef
  }

  setupNvimOnHandlers() {
    if (this._actionRegistrations.length)
      this._actionRegistrations.forEach((name) =>
        this._workerInstanceRef.call.onAction(name)
      )
    this._workerInstanceRef.on.nvimStateUpdate((stateDiff: any) => {
      // TODO: do we need this to always be updated or can we query these values?
      // this will trigger on every cursor move and take up time in the render cycle
      Object.assign(this._nvimState, stateDiff)
    })

    // TODO(smolck): Async? Return promise?
    // this.workerInstanceRef.on.showNeovimMessage(async (...a: any[]) => {
    this._workerInstanceRef.on.showNeovimMessage((...a: any[]) => {
      this._winRef.webContents.send('fromMain', ['nvim.showNeovimMessage', a])
    })

    this._workerInstanceRef.on.showStatusBarMessage((message: string) => {
      this._winRef.webContents.send('fromMain', [
        'nvim.message.status',
        message,
      ])
    })

    this._workerInstanceRef.on.vimrcLoaded(() =>
      this._ee.emit('nvim.load', false)
    )
    this._workerInstanceRef.on.gitStatus((status: GitStatus) =>
      this._ee.emit('git.status', status)
    )
    this._workerInstanceRef.on.gitBranch((branch: string) =>
      this._ee.emit('git.branch', branch)
    )
    this._workerInstanceRef.on.actionCalled((name: string, args: any[]) =>
      this._ee.emit(`action.${name}`, ...args)
    )

    // TODO(smolck): What to do here . . .
    /*this.workerInstanceRef.on.getDefaultColors(async () => ({
      background: colors.background,
      foreground: colors.foreground,
      special: colors.special,
    }))*/

    this._workerInstanceRef.on.getCursorPosition(async () => {
      // TODO(smolck): What to do here exactly?
      /*const {
        cursor: { row, col },
      } = require('../core/cursor')
      return { row, col }*/
    })

    this._workerInstanceRef.on.clipboardRead(async () => clipboard.readText())
    this._workerInstanceRef.on.clipboardWrite((text: string) =>
      clipboard.writeText(text)
    )
  }

  getBufferInfo(): Promise<BufferInfo> {
    return this._workerInstanceRef.request.getBufferInfo()
  }

  setMode(mode: VimMode) {
    Object.assign(this._nvimState, { mode })
    this._workerInstanceRef.call.setNvimMode(mode)
  }

  async getWindowMetadata(): Promise<WindowMetadata[]> {
    return this._workerInstanceRef.request.getWindowMetadata()
  }

  onAction(name: string, fn: (...args: any[]) => void) {
    if (typeof fn !== 'function')
      throw new Error(`nvim.onAction needs a function for event ${name}`)

    this._actionRegistrations.push(name)
    this._ee.on(`action.${name}`, fn)

    try {
      this._workerInstanceRef.call.onAction(name)
    } catch (_) {
      // not worried if no instance, we will register later in 'onCreateVim'
    }
  }

  gitOnStatus(fn: (status: GitStatus) => void) {
    this._ee.on('git.status', fn)
  }
  gitOnBranch(fn: (branch: string) => void) {
    this._ee.on('git.branch', fn)
  }

  bufferSearch(file: string, query: string) {
    return this._workerInstanceRef.request.bufferSearch(file, query)
  }

  bufferSearchVisible(query: string) {
    return this._workerInstanceRef.request.bufferSearchVisible(query)
  }

  onNvimLoaded(fn: (switchInstance: boolean) => void) {
    this._ee.on('nvim.load', fn)
  }

  nvimGetVar(key: string) {
    return this._workerInstanceRef.request.nvimGetVar(key)
  }

  nvimCommand(command: string) {
    this._workerInstanceRef.call.nvimCommand(command)
  }

  nvimFeedkeys(keys: string, mode = 'm') {
    this._workerInstanceRef.call.nvimFeedkeys(keys, mode)
  }

  nvimExpr(expr: string) {
    // TODO(smolck): Return here necessary?
    return this._workerInstanceRef.request.nvimExpr(expr)
  }

  nvimCall: Functions = onFnCall((name, a) =>
    this._workerInstanceRef.request.nvimCall(name, a)
  )

  nvimJumpTo(coords: HyperspaceCoordinates) {
    this._workerInstanceRef.call.nvimJumpTo(coords)
  }

  nvimGetKeymap() {
    return this._workerInstanceRef.request.nvimGetKeymap()
  }

  nvimGetColorByName(name: string) {
    return this._workerInstanceRef.request.nvimGetColorByName(name)
  }

  async nvimSaveCursor() {
    // TODO(smolck): Is this const necessary?
    const instance = this._workerInstanceRef
    const pos = await this._workerInstanceRef.request.nvimSaveCursor()
    return () => instance.call.nvimRestoreCursor(pos)
  }

  async nvimHighlightSearchPattern(
    pattern: string,
    id?: number
  ): Promise<number> {
    return this._workerInstanceRef.request.nvimHighlightSearchPattern(
      pattern,
      id
    )
  }

  async nvimRemoveHighlightSearch(
    id: number,
    pattern?: string
  ): Promise<boolean> {
    return this._workerInstanceRef.request.nvimRemoveHighlightSearch(
      id,
      pattern
    )
  }

  onInputRemapModifiersDidChange(fn: (modifiers: any[]) => void) {
    this._ee.on('input.remap.modifiers', fn)
  }

  onInputKeyTransformsDidChange(fn: (transforms: any[]) => void) {
    this._ee.on('input.key.transforms', fn)
  }
}
