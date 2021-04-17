import { contextBridge, ipcRenderer, } from 'electron'

const funcs: any = {}
ipcRenderer.on('fromMain', (_, [event, ...args]) => {
  funcs[event](...args)
})

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  call: (funcName: string, ...args: any[]) => {
    ipcRenderer.send('toMain', [funcName, ...args])
  },
  on: (event: string, func: (...args: any[]) => void) => {
    funcs[event] = func
  }
})
