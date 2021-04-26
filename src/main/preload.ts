import { contextBridge, ipcRenderer } from 'electron'
// TODO(smolck): Import from there is fine or . . . ?
import { WindowMetadata } from '../renderer/windows/metadata'

// TODO(smolck): Typing? Etc.?
let nvimState: any = undefined
let workerInstanceId: number | undefined = undefined

const funcs: any = {
  'nvim.state': (state: any) => { nvimState = state },
  'nvim.workerInstanceId': (id: number) => { workerInstanceId = id },
}
ipcRenderer.on('fromMain', (_, [event, ...args]) => {
  funcs[event](...args)
})

let watchStateFileId = 0

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  call: (funcName: string, ...args: any[]) => {
    ipcRenderer.send('toMain', [funcName, ...args])
  },
  on: (event: string, func: (...args: any[]) => void) => {
    funcs[event] = func
  },
  nvimState: {
    // TODO(smolck)
    watchStateFile: (fn: (file: string) => void) => {
      const funcId = watchStateFileId
      ipcRenderer.send('toMain', ['nvim.watchState.file', funcId])
      watchStateFileId++

      ipcRenderer.on('fromMain', (_, [event, id, file]) => {
        if (event === 'nvim.watchState.file' && id === funcId) {
          fn(file)
        }
      })
    },
    state: () => {
      if (nvimState === undefined) {
        throw new Error('Umm . . . yeah this should be defined, nvimState, preload')
      }
      return nvimState
    },
  },
  workerInstanceId: () => {
    if (workerInstanceId === undefined) {
      throw new Error('Umm . . . yeah this should be defined, workerInstanceId, preload')
    }
    return workerInstanceId
  },
  getWindowMetadata: (): Promise<WindowMetadata[]> => {
    ipcRenderer.send('toMain', ['nvim.instanceApi.getWindowMetadata'])
    return new Promise((resolve, _reject) => {
      ipcRenderer.once('fromMain', (_event, [event, windowMetdata]) => {
        if (event === 'nvim.instanceApi.getWindowMetadata') {
          resolve(windowMetdata)
        }
      })
    })
  }
})
