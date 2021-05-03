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

ipcRenderer.on(Events.nvimState, (_event, state) => (nvimState = state))

const api: WindowApi = {
  luaeval: (...args) => ipcRenderer.invoke(InternalInvokables.luaeval, ...args),
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
    ipcRenderer
      .invoke(InternalInvokables.gitOnStatus)
      .then((status) => fn(status)),
  gitOnStatus: (fn: (branch: any) => void) =>
    ipcRenderer
      .invoke(InternalInvokables.gitOnBranch)
      .then((branch) => fn(branch)),

  nvimWatchState: (key: string, fn: any) =>
    ipcRenderer
      .invoke(InternalInvokables.nvimWatchState, key)
      .then((newStateThing) => fn(newStateThing)),

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
    return await ipcRenderer.invoke(Invokables.getWindowMetadata)
  },

  // TODO(smolck): This should be safe I think . . .
  // at least as long as the callable invokables are safe to expose.
  invoke: async (invokable, ...args) => {
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
