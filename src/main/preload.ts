import { contextBridge, ipcRenderer } from 'electron'

const funcs: any = {}
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
    }
  }
})
