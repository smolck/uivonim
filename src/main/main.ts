import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import Nvim, { MasterControl as NvimType } from './core/master-control'
import Input from './core/input'
import { Events, Invokables, InternalInvokables } from '../common/ipc'

if (process.platform === 'darwin') {
  // For some reason '/usr/local/bin' isn't in the path when
  // running on macOS, and if the `nvim` binary is located there
  // then uivonim won't work properly (since no Neovim instance can
  // be spawned).
  process.env.PATH += ':/usr/local/bin'
}

let win: BrowserWindow
app.setName('uivonim')

const comscan = (() => {
  type DispatchFn = (ch: string, message: any) => void
  const windows = new Set<DispatchFn>()
  const register = (fn: DispatchFn) => windows.add(fn)
  const dispatch = (ch: string, message: any) =>
    windows.forEach((cb) => cb(ch, message))
  return { register, dispatch }
})()

app.on('ready', async () => {
  const menuTemplate = [
    {
      label: 'Window',
      submenu: [
        {
          role: 'togglefullscreen',
        },
        {
          label: 'Maximize',
          click: () => win.maximize(),
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Developer Tools',
          accelerator: 'CmdOrCtrl+|',
          click: () => win.webContents.toggleDevTools(),
        },
      ] as any,
    } as any,
  ]

  if (process.platform === 'darwin')
    menuTemplate.unshift({
      label: 'uivonim',
      submenu: [
        {
          role: 'about',
        },
        {
          type: 'separator',
        },
        {
          // using 'role: hide' adds cmd+h keybinding which overrides vim keybinds
          label: 'Hide uivonim',
          click: () => app.hide(),
        },
        {
          type: 'separator',
        },
        {
          role: 'quit' as any,
        },
      ] as any,
    } as any)

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  win = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    frame: true,
    titleBarStyle: 'hidden',
    backgroundColor: '#222',
    autoHideMenuBar: true,
    webPreferences: {
      // TODO(smolck): Long-term solution is to stop using `remote` entirely,
      // see https://github.com/electron/electron/issues/21408 and
      // https://medium.com/@nornagon/electrons-remote-module-considered-harmful-70d69500f31
      enableRemoteModule: true,
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
    },
  })

  win.loadURL(`file:///${__dirname}/index.html`)
  comscan.register((ch, msg) => win.webContents.send(ch, msg))

  if (process.env.VEONIM_DEV) {
    function debounce(fn: Function, wait = 1) {
      let timeout: NodeJS.Timer
      return function (this: any, ...args: any[]) {
        const ctx = this
        clearTimeout(timeout)
        timeout = setTimeout(() => fn.apply(ctx, args), wait)
      }
    }

    const { watch } = require('fs')
    const srcDir = require('path').resolve(__dirname, '../../build')
    console.log('scrdir:', srcDir)

    const reloader = () => {
      console.log('reloading changes...')
      win.webContents.reload()
    }

    watch(srcDir, { recursive: true }, debounce(reloader, 250))
    console.log(`uivonim started in develop mode.`)
    win.webContents.openDevTools()
  }

  await afterReadyThings()
})

async function afterReadyThings() {
  win.on('enter-full-screen', () =>
    win.webContents.send(Events.windowEnterFullScreen)
  )
  win.on('leave-full-screen', () =>
    win.webContents.send(Events.windowLeaveFullScreen)
  )

  // TODO(smolck): cli args
  const nvim = await Nvim(win, { useWsl: false })

  nvim.instanceApi.onAction('version', () =>
    nvim.instanceApi.nvimCommand(`echo 'Uivonim v${app.getVersion()}'`)
  )
  nvim.instanceApi.onAction('devtools', win.webContents.toggleDevTools)

  const _input = Input(
    nvim.instanceApi,
    nvim.input,
    (fn) => win.on('focus', fn),
    (fn) => win.on('blur', fn)
  )
  setupInvokeHandlers(nvim)

  nvim.onRedraw((redrawEvents) =>
    win.webContents.send(Events.nvimRedraw, redrawEvents)
  )
  nvim.instanceApi.watchState.colorscheme(() =>
    win.webContents.send(Events.colorschemeStateUpdated)
  )

  // Initial state and send state every change
  // TODO(smolck): (Will) This work as I want it to?
  win.webContents.send(Events.nvimState, nvim.instanceApi.state)

  nvim.instanceApi.onStateChange((nextState) =>
    win.webContents.send(Events.nvimState, nextState)
  )

  win.webContents.send(Events.workerInstanceId, nvim.workerInstanceId())
}

async function setupInvokeHandlers(nvim: NvimType) {
  ipcMain.handle(Invokables.getWindowMetadata, async (_event, _args) => {
    return await nvim.instanceApi.getWindowMetadata()
  })

  ipcMain.handle(Invokables.winGetAndSetSize, async (_event, _args) => {
    const [width, height] = win.getSize()
    win.setSize(width + 1, height)
    win.setSize(width, height)
  })

  ipcMain.handle(Invokables.nvimResize, async (_event, width, height) => {
    nvim.resize(width, height)
  })

  ipcMain.handle(
    Invokables.nvimResizeGrid,
    async (_event, grid, width, height) => {
      nvim.resizeGrid(grid, width, height)
    }
  )

  ipcMain.handle(InternalInvokables.nvimWatchStateFile, (_event, _args) => {
    // TODO(smolck)
    return new Promise((resolve, _reject) =>
      nvim.instanceApi.watchState.file((file) => resolve(file))
    )
  })
}
