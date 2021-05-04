import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import Nvim, { MasterControl as NvimType } from './core/master-control'
import Input, { Input as InputType } from './core/input'
import { Events, Invokables, InternalInvokables } from '../common/ipc'
import { InstanceApi } from './core/instance-api'
import * as path from 'path'
import { getDirFiles, getDirs, $HOME } from '../common/utils'
import { GenericCallback } from '../common/types'

if (process.platform === 'darwin') {
  // For some reason '/usr/local/bin' isn't in the path when
  // running on macOS, and if the `nvim` binary is located there
  // then uivonim won't work properly (since no Neovim instance can
  // be spawned).
  process.env.PATH += ':/usr/local/bin'
}

let win: BrowserWindow
let nvim: NvimType
let input: InputType
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
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadURL(`file:///${__dirname}/index.html`)
  comscan.register((ch, msg) => win.webContents.send(ch, msg))

  /*if (process.env.VEONIM_DEV) {
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
  }*/
  win.webContents.openDevTools()

  win.webContents.on('did-finish-load', async () => await afterReadyThings())
})

const getCircularReplacer = () => {
  const seen = new WeakSet()
  return (_key: any, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return
      }
      seen.add(value)
    }
    return value
  }
}

async function afterReadyThings() {
  win.webContents.send(Events.homeDir, $HOME)
  win.on('enter-full-screen', () =>
    win.webContents.send(Events.windowEnterFullScreen)
  )
  win.on('leave-full-screen', () =>
    win.webContents.send(Events.windowLeaveFullScreen)
  )

  nvim = await Nvim(win, { useWsl: false })
  nvim.onExit(app.quit)
  input = Input(
    nvim.instanceApi,
    nvim.input,
    (fn) => win.on('focus', fn),
    (fn) => win.on('blur', fn)
  )

  // TODO(smolck): cli args
  nvim.instanceApi.onAction('version', () =>
    nvim.instanceApi.nvimCommand(`echo 'Uivonim v${app.getVersion()}'`)
  )
  nvim.instanceApi.onAction('devtools', win.webContents.toggleDevTools)

  nvim.onRedraw((redrawEvents) => {
    win.webContents.send(
      Events.nvimRedraw,
      // TODO(smolck): Perf of this? Without doing this and parsing on the other
      // side, there are errors about the object being too nested sometimes;
      // this seems to fix that, but not sure if there's a better way (e.g.
      // parsing the redraw events here, on the main thread, and then sending
      // over smaller events and such to the render thread)?
      JSON.stringify(redrawEvents, getCircularReplacer())
    )
  })

  setupActionHandlers(nvim.instanceApi)
  await setupInvokeHandlers()
  win.webContents.send(Events.invokeHandlersReady)

  nvim.instanceApi.watchState.colorscheme(() =>
    win.webContents.send(Events.colorschemeStateUpdated)
  )

  // Initial state and send state every change
  // TODO(smolck): (Will) This work as I want it to?
  win.webContents.send(
    Events.nvimState,
    JSON.parse(JSON.stringify(nvim.instanceApi.state))
  )

  nvim.instanceApi.onStateChange((nextState) =>
    win.webContents.send(Events.nvimState, nextState)
  )
}

function setupActionHandlers(instanceApi: InstanceApi) {
  const sendOn = (action: string, evt: typeof Events[keyof typeof Events]) =>
    instanceApi.onAction(action, (...args) =>
      win.webContents.send(evt, ...args)
    )

  sendOn('nc', Events.ncAction)
  sendOn('signature-help', Events.signatureHelpAction)
  sendOn('signature-help-close', Events.signatureHelpCloseAction)
  sendOn('buffers', Events.buffersAction)
  sendOn('references', Events.referencesAction)
  sendOn('code-action', Events.codeActionAction)
  sendOn('hover', Events.hoverAction)
  sendOn('hover-close', Events.hoverCloseAction)
  sendOn('pick-color', Events.pickColor)
  sendOn('explorer', Events.explorer)
  sendOn('update-nameplates', Events.updateNameplates)
}

async function setupInvokeHandlers() {
  // @ts-ignore
  const handle: {
    [Key in keyof typeof Invokables]: (fn: GenericCallback) => void
  } = new Proxy(Invokables, {
    get: (target, key) => (fn: GenericCallback) => {
      ipcMain.handle(Reflect.get(target, key), (_event, ...args) => fn(...args))
    },
  })

  // @ts-ignore
  const handleInternal: {
    [Key in keyof typeof InternalInvokables]: (fn: GenericCallback) => void
  } = new Proxy(InternalInvokables, {
    get: (target, key) => (fn: GenericCallback) => {
      ipcMain.handle(Reflect.get(target, key), (_event, ...args) => fn(...args))
    },
  })

  handleInternal.nvimWatchState(
    (thing: any) =>
      new Promise((resolve, _) =>
        // @ts-ignore
        nvim.instanceApi.watchState[thing]((x) => resolve(x))
      )
  )
  handleInternal.gitOnBranch(
    () =>
      new Promise((resolve, _) =>
        nvim.instanceApi.gitOnBranch((branch) => resolve(branch))
      )
  )

  handleInternal.gitOnStatus(
    () =>
      new Promise((resolve, _) =>
        nvim.instanceApi.gitOnStatus((status) => resolve(status))
      )
  )
  handleInternal.stealInput(
    () =>
      new Promise((resolve, _) =>
        input.stealInput((inputKeys, inputType) =>
          resolve([inputKeys, inputType])
        )
      )
  )
  handleInternal.restoreInput(() => input.restoreInput())
  // TODO(smolck): Security if we add web browsing feature
  handleInternal.luaeval(() =>
    // @ts-ignore
    nvim.instanceApi.nvimCall.luaeval()
  )
  handleInternal.setWinTitle(win.setTitle)

  handle.getWindowMetadata(() => nvim.instanceApi.getWindowMetadata())
  handle.winGetAndSetSize(() => {
    const [width, height] = win.getSize()
    win.setSize(width + 1, height)
    win.setSize(width, height)
  })
  handle.nvimResize((width, height) => nvim.resize(width, height))
  handle.nvimResizeGrid((grid, width, height) =>
    nvim.resizeGrid(grid, width, height)
  )
  handle.inputBlur(() => input.blur())
  handle.inputFocus(() => input.focus())
  handle.getColorByName((name) => nvim.instanceApi.nvimGetColorByName(name))
  handle.setMode((mode) => nvim.instanceApi.setMode(mode))
  handle.registerOneTimeUseShortcuts(
    (shortcuts: any) =>
      new Promise((resolve, _) =>
        input.registerOneTimeUseShortcuts(shortcuts, (shorts) =>
          resolve(shorts)
        )
      )
  )

  handle.getBufferInfo(() => nvim.instanceApi.getBufferInfo())
  handle.nvimJumpTo((coords) => nvim.instanceApi.nvimJumpTo(coords))
  handle.expand((thing) => nvim.instanceApi.nvimCall.expand(thing))
  handle.nvimCmd((cmd) => nvim.instanceApi.nvimCommand(cmd))

  // TODO(smolck): Security of this? Fine for now, but if we are wanting to
  // browse the web in the same browser window (future feature idea) then this'll
  // probably need to change, since exposing this to the outside world
  // (specifically the homeDir event used at the start of `afterReadyThings` above)
  // feels like a bad idea.
  //
  // Note that this is all really just so that `src/renderer/components/extensions/explorer.tsx` can work.
  handle.getDirs(getDirs)
  handle.getDirFiles(getDirFiles)
}
