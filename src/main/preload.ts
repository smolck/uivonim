import { contextBridge, ipcRenderer } from 'electron'
import { WindowMetadata } from '../common/types'
import {
  Events,
  Invokables,
  InternalInvokables,
  WindowApi,
} from '../common/ipc'

// TODO(smolck): Typing? Etc.?
let nvimState: any = undefined
let homeDir = ''
let onReady = new Promise((resolve, _) =>
  ipcRenderer.on(Events.invokeHandlersReady, () => resolve(null))
)

ipcRenderer.on(Events.nvimState, (_event, state) => (nvimState = state))
ipcRenderer.on(Events.homeDir, (_event, dir) => (homeDir = dir))

const api: WindowApi = {
  // TODO(smolck): Security of this if we ever add a web browsing feature
  isMacos: process.platform === 'darwin',
  homeDir,
  setWinTitle: (newTitle) =>
    ipcRenderer.invoke(InternalInvokables.setWinTitle, newTitle),
  luaeval: async (...args) => {
    await onReady
    return ipcRenderer.invoke(InternalInvokables.luaeval, ...args)
  },
  on: (event, func: (...args: any[]) => void) => {
    // Derived from https://stackoverflow.com/a/35948779
    if (Object.values(Events).indexOf(event) > -1) {
      ipcRenderer.on(event, (_event, ...args) => {
        func(...args)
      })
    } else {
      const message = `Tried to handle event ${event} that isn't a valid event: this should NOT happen`
      // TODO(smolck): Doing both is probably overkill, yeah?
      console.error(message)
      throw new Error(message)
    }
  },

  stealInput: (fn) => {
    ipcRenderer
      .invoke(InternalInvokables.stealInput)
      .then(([inputKeys, inputType]) => fn(inputKeys, inputType))
  },

  restoreInput: () => {
    return ipcRenderer.invoke(InternalInvokables.restoreInput)
  },

  gitOnBranch: (fn: (status: any) => void) =>
    onReady.then(() =>
      ipcRenderer.invoke(InternalInvokables.gitOnStatus).then(fn)
    ),
  gitOnStatus: (fn: (branch: any) => void) =>
    onReady.then(() =>
      ipcRenderer.invoke(InternalInvokables.gitOnBranch).then(fn)
    ),

  nvimWatchState: (key: string, fn: any) =>
    onReady.then(() =>
      ipcRenderer
        .invoke(InternalInvokables.nvimWatchState, key)
        .then((newStateThing) => fn(newStateThing))
    ),

  nvimState: {
    // TODO(smolck)
    state: () => {
      if (nvimState === undefined) {
        throw new Error(
          'Umm . . . yeah this should be defined, nvimState, preload'
        )
      }
      return nvimState
    },
  },
  getWindowMetadata: async (): Promise<WindowMetadata[]> => {
    await onReady
    return await ipcRenderer.invoke(Invokables.getWindowMetadata)
  },

  // TODO(smolck): This should be safe I think . . .
  // at least as long as the callable invokables are safe to expose.
  invoke: async (invokable, ...args) => {
    await onReady
    // TODO(smolck): Perf of this?
    // Derived from https://stackoverflow.com/a/35948779
    if (Object.values(Invokables).indexOf(invokable) > -1) {
      return await ipcRenderer.invoke(invokable, ...args)
    } else {
      const message = `Tried to call invokable ${invokable} that isn't valid: this should NOT happen`
      // TODO(smolck): Doing both is probably overkill, yeah?
      console.error(message)
      throw new Error(message)
    }
  },
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', api)
