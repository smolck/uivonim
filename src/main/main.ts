import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import Nvim from './core/master-control'

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
    win.webContents.send('fromMain', ['window-enter-full-screen'])
  )
  win.on('leave-full-screen', () =>
    win.webContents.send('fromMain', ['window-leave-full-screen'])
  )

  // TODO(smolck): cli args
  const nvim = new Nvim({ useWsl: false })
  await nvim.init(win)

  const handlers: any = {
    'nvim.resize': nvim.resize,
    'nvim.resizeGrid': nvim.resizeGrid,
    'win.getAndSetSize': () => {
      const [width, height] = win.getSize()
      win.setSize(width + 1, height)
      win.setSize(width, height)
    },
    'nvim.watchState.file': (id: number) => {
      nvim.instanceApi.nvimState.watchState.file((file) => win.webContents.send(
        'fromMain',
        ['nvim.watchState.file', id, file]
      ))
    }
  }

  nvim.onRedraw((args) =>
    win.webContents.send('fromMain', ['nvim.onRedraw', args])
  )

  ipcMain.on('toMain', (_event, args: any[]) => {
    // TODO(smolck): use `_event`? what's the purpose of it?
    handlers[args[0]](...args.slice(1))
  })
}
