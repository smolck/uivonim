import { contextBridge, ipcRenderer, BrowserWindow } from 'electron'
import { promisify } from 'util'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  winOn: (event: string, func: () => void) => {
    ipcRenderer.send('toMain', ['win.on', event, func])
  },
  appArgsSync: () => {
    const args = ipcRenderer.sendSync('toMain', ['process.argv'])
    return args
  },
  startApp: () => {
    require('../bootstrap/galaxy')
  }
        /*send: (channel, data) => {
            // whitelist channels
            let validChannels = ["toMain"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ["fromMain"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }*/
  }
)
