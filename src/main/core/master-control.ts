import { asColor, merge, getPipeName } from '../../common/utils'
import Worker from '../messaging/worker'
import { startupFuncs, startupCmds } from '../neovim/startup'
import { Color, Highlight } from '../neovim/types'
import { ChildProcess, spawn } from 'child_process'
import { setupNvimOnHandlers } from '../core/instance-api'
import * as neovim from 'neovim'

type RedrawFn = (m: any[]) => void
type ExitFn = (code: number) => void

interface NvimInstance {
  proc: ChildProcess
  attached: boolean
  pipeName: string
}

const nvimOptions = {
  ext_popupmenu: true,
  ext_tabline: true,
  ext_wildmenu: true,
  ext_cmdline: true,
  ext_messages: true,
  ext_multigrid: true,
  ext_hlstate: true,
}

const clientSize = {
  width: 0,
  height: 0,
}

let onExitFn: ExitFn = () => {}

const spawnNvimInstance = (
  pipeName: string,
  useWsl: boolean,
  nvimBinary?: string
) => {
  const args = [
    '--cmd',
    `${startupFuncs()} | ${startupCmds}`,
    '--cmd',
    `com! -nargs=+ -range -complete=custom,UivonimCmdCompletions Uivonim call Uivonim(<f-args>)`,
    '--embed',
    '--listen',
    pipeName,
  ]
  return useWsl
    ? spawn('wsl', [nvimBinary ?? 'nvim', ...args])
    : spawn(nvimBinary ?? 'nvim', args)
}

const attachNvim = (nvimInstance: NvimInstance) => {
  const nvimApi = neovim.attach({ proc: nvimInstance.proc })
  if (!nvimInstance) {
    console.warn(
      'Tried attaching nvim before initializing it, and/or setup api'
    )
  }
  if (nvimInstance.attached) {
    console.warn('Already attached nvim')
  }

  nvimApi.uiAttach(clientSize.width, clientSize.height, nvimOptions)
  // highlight groups defined before nvim_ui_attach get reset
  nvimApi.command(`highlight ${Highlight.Undercurl} gui=undercurl`)
  nvimApi.command(`highlight ${Highlight.Underline} gui=underline`)
  nvimInstance.attached = true

  return nvimApi
}

const createAndSetupNvimInstance = (useWsl: boolean, nvimBinary?: string) => {
  const pipeName = getPipeName('veonim-instance')
  const proc = spawnNvimInstance(pipeName, useWsl, nvimBinary)

  const nvimInstance = { proc, pipeName, attached: false }

  proc.on('error', (e: any) => console.error(`nvim err ${e}`))
  proc.stdout!.on('error', (e: any) =>
    console.error(`nvim stdout err ${JSON.stringify(e)}`)
  )
  proc.stdin!.on('error', (e: any) =>
    console.error(`nvim stdin err ${JSON.stringify(e)}`)
  )
  proc.on('exit', (c: any) => onExitFn(c))

  const nvimApi = attachNvim(nvimInstance)
  // TODO(smolck): if (!nvimApi) ???
  const { attached } = nvimInstance

  // sending resize (even of the same size) makes vim instance clear/redraw screen
  // this is how to repaint the UI with the new vim instance. not the most obvious...
  if (attached) nvimApi.uiTryResize(clientSize.width, clientSize.height)

  return { instance: nvimInstance, api: nvimApi }
}

const createNvim = async (
  useWsl: boolean,
  nvimBinaryPath?: string,
  dir?: string
) => {
  const { instance: nvimInstance, api: nvimApi } = createAndSetupNvimInstance(
    useWsl,
    nvimBinaryPath
  )
  const { pipeName: path } = nvimInstance!

  const workerInstance = Worker('instance', {
    workerData: { nvimPath: path },
  })
  setupNvimOnHandlers()

  dir && (await nvimApi!.command(`cd ${dir}`))
  return { workerInstance, nvimInstance, nvimApi }
}

export default class {
  private _nvimInstance?: NvimInstance
  private _nvimApi?: neovim.Neovim
  private _workerInstance?: any
  private _opts: { useWsl: boolean; nvimBinaryPath?: string; dir?: string }

  // TODO(smolck): Check initialized in getters?
  private get nvimApi() {
    this.checkInitialized()
    return this._nvimApi!
  }

  constructor(opts: {
    useWsl: boolean
    nvimBinaryPath?: string
    dir?: string
  }) {
    this._opts = opts
  }

  private checkInitialized() {
    if (!this._nvimInstance || !this._nvimApi || !this._workerInstance) {
      console.error('Nvim not initalized! Need to call and await .init()')
    }
  }

  async init() {
    const { nvimInstance, nvimApi, workerInstance } = await createNvim(
      this._opts.useWsl,
      this._opts.nvimBinaryPath,
      this._opts.dir
    )
    this._nvimInstance = nvimInstance
    this._workerInstance = workerInstance
    this._nvimApi = nvimApi
  }

  onRedraw(fn: RedrawFn) {
    this.nvimApi.on('notification', (method: string, args: any) =>
      method === 'redraw' ? fn(args) : {}
    )
  }

  input(keys: string) {
    this.nvimApi.input(keys)
    // TODO(smolck): Maybe need a ref to `win`; need to tell the render thread to do
    // this . . .
    /* if (document.activeElement === document.body) {
      document.getElementById('keycomp-textarea')?.focus()
    }*/
  }

  async getMode() {
    const mode = await this.nvimApi.mode
    console.log(`getmode: ${mode}`)
    return mode as { mode: string; blocking: boolean }
    // (await nvimApi!.mode) as { mode: string; blocking: boolean }
  }

  resizeGrid(grid: number, width: number, height: number) {
    this.nvimApi.uiTryResizeGrid(grid, width, height)
  }

  resize(width: number, height: number) {
    merge(clientSize, { width, height })
    this.nvimApi.uiTryResize(width, height)
  }

  async getColor(id: number) {
    const { foreground, background } = (await this.nvimApi.getHighlightById(
      id,
      true
    )) as Color
    return {
      fg: asColor(foreground),
      bg: asColor(background),
    }
  }
}
