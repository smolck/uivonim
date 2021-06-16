import { contextBridge, ipcRenderer } from 'electron'
import { WindowMetadata } from '../common/types'
import {
  Events,
  Invokables,
  InternalInvokables,
  WindowApi,
  SyncEvents,
} from '../common/ipc'
import { NeovimState } from '../main/neovim/state'

let nvimState: NeovimState | undefined = undefined
let homeDir = ''
let initialAtlas: any
ipcRenderer.on(Events.initialFontAtlasInfoReceieved, (_evt, atlas) => {
  initialAtlas = atlas
})
let onReady = new Promise((resolve, _) => ipcRenderer.on(Events.invokeHandlersReady, () => resolve(null)))

ipcRenderer.on(Events.nvimState, (_event, state) => (nvimState = state))
ipcRenderer.on(Events.homeDir, (_event, dir) => (homeDir = dir))

const api: WindowApi = {
  initialAtlas: () => initialAtlas,
  onRedrawEvent: (evt, fn) => {
    ipcRenderer.on(evt, (_evt, ...args) => fn(...args))
  },

  // TODO(smolck): Security of this if we ever add a web browsing feature
  isMacos: process.platform === 'darwin',
  homeDir,
  setWinTitle: (newTitle) =>
    ipcRenderer.invoke(InternalInvokables.setWinTitle, newTitle),
  luaeval: async (...args) => {
    await onReady
    return ipcRenderer.invoke(InternalInvokables.luaeval, ...args)
  },
  sendSyncEvent: (event, ...args) => {
    if (Object.values(SyncEvents).indexOf(event) > -1) {
      console.log('sup', event)
      const ret = ipcRenderer.sendSync(event, ...args)
      console.log(ret)
      return ret
    } else {
      const message = `Tried to send synchronous event ${event} that isn't a valid event: this should NOT happen`
      throw new Error(message)
    }
  },
  on: (event, func: (...args: any[]) => void) => {
    // Derived from https://stackoverflow.com/a/35948779
    if (Object.values(Events).indexOf(event) > -1) {
      ipcRenderer.on(event, (_event, ...args) => {
        func(...args)
      })
    } else {
      const message = `Tried to handle event ${event} that isn't a valid event: this should NOT happen`
      throw new Error(message)
    }
  },

  stealInput: (fn) => {
    ipcRenderer
      .invoke(InternalInvokables.stealInput)
      .then(([inputKeys, inputType]) => fn(inputKeys, inputType))
  },

  restoreInput: () => ipcRenderer.invoke(InternalInvokables.restoreInput),

  gitOnBranch: (fn: (branch: any) => void) =>
    ipcRenderer.on(Events.gitOnBranch, (_, b) => fn(b)),
  gitOnStatus: (fn: (status: any) => void) =>
    ipcRenderer.on(Events.gitOnStatus, (_, s) => fn(s)),

  nvimWatchState: (key, fn) =>
    ipcRenderer.on(Events.nvimState, (_event, newState) => fn(newState[key])),
  nvimState: () => {
    if (!nvimState) {
      throw new Error(
        'Umm . . . yeah this should be defined, nvimState, preload'
      )
    }
    return nvimState
  },
  getWindowMetadata: async (): Promise<WindowMetadata[]> => {
    await onReady
    return await ipcRenderer.invoke(Invokables.getWindowMetadata)
  },

  invoke: async (invokable, ...args) => {
    await onReady
    // TODO(smolck): Perf of this?
    // Derived from https://stackoverflow.com/a/35948779
    if (Object.values(Invokables).indexOf(invokable) > -1) {
      return await ipcRenderer.invoke(invokable, ...args)
    } else {
      const message = `Tried to call invokable ${invokable} that isn't valid: this should NOT happen`
      throw new Error(message)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)
