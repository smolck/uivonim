import { app, BrowserWindow, Menu } from 'electron'

let win: any
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
      ] as any, // electron is stupid,
    } as any,
  ]

  if (process.platform === 'darwin')
    menuTemplate.unshift({
      label: 'veonim',
      submenu: [
        {
          role: 'about',
        },
        {
          type: 'separator',
        },
        {
          // using 'role: hide' adds cmd+h keybinding which overrides vim keybinds
          label: 'Hide veonim',
          click: () => app.hide(),
        },
        {
          type: 'separator',
        },
        {
          role: 'quit' as any,
        },
      ] as any, // electron is stupid
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

    console.log(`veonim started in develop mode. you're welcome`)

    const {
      default: installExtension,
      REACT_DEVELOPER_TOOLS,
      REDUX_DEVTOOLS,
    } = require('electron-devtools-installer')

    const load = (ext: any) =>
      installExtension(ext)
        .then((n: any) => console.log('loaded ext:', n))
        .catch((e: any) => console.log('failed to load ext because...', e))

    // TODO: .id is a hack to make it work for electron 2.0+
    load(REACT_DEVELOPER_TOOLS.id)
    load(REDUX_DEVTOOLS.id)

    win.webContents.on('devtools-opened', () => setImmediate(() => win.focus()))
    win.webContents.openDevTools()
  }
})
