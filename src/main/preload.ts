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
let workerInstanceId: number | undefined = undefined

ipcRenderer.on(
  Events.nvimState,
  (_event, state) => (nvimState = JSON.parse(state))
)
ipcRenderer.on(Events.workerInstanceId, (_event, id) => (workerInstanceId = id))

const api: WindowApi = {
  on: (event: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(event, (_event, ...args) => func(...args))
  },
  nvimWatchStateFile: (fn: (file: string) => void) => {
    // TODO(smolck): This works, right?
    ipcRenderer.invoke(InternalInvokables.nvimWatchStateFile).then((file) => {
      fn(file)
    })
  },
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
  workerInstanceId: () => {
    if (workerInstanceId === undefined) {
      throw new Error(
        'Umm . . . yeah this should be defined, workerInstanceId, preload'
      )
    }
    return workerInstanceId
  },
  getWindowMetadata: async (): Promise<WindowMetadata[]> => {
    return await ipcRenderer.invoke(Invokables.getWindowMetadata)
  },

  // TODO(smolck): This should be safe I think . . .
  // at least as long as the callable invokables are safe to expose.
  invoke: async (invokable, ...args) => {
    // TODO(smolck): Perf of this?
    if (invokable in Invokables) {
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
