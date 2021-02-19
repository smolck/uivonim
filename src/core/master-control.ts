import { asColor, merge, getPipeName } from '../support/utils'
import Worker from '../messaging/worker'
import { startupFuncs, startupCmds } from '../neovim/startup'
import { Color, Highlight } from '../neovim/types'
import { ChildProcess, spawn } from 'child_process'
import { setupNvimOnHandlers } from '../core/instance-api'
import { remote } from 'electron'
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
let nvimInstance: NvimInstance | undefined = undefined
let workerInstance: any = undefined
let nvimApi: neovim.Neovim | undefined = undefined

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

const setupNvimInstance = () => {
  if (!nvimApi) {
    throw new Error('setupNvimInstance called before attachNvim, this shouldn\'t happen')
  }
  const { attached } = nvimInstance!

  // sending resize (even of the same size) makes vim instance clear/redraw screen
  // this is how to repaint the UI with the new vim instance. not the most obvious...
  if (attached) nvimApi!.uiTryResize(clientSize.width, clientSize.height)
}

const attachNvim = () => {
  nvimApi = neovim.attach({ proc: nvimInstance!.proc })
  if (!nvimInstance) {
    console.warn(
      'Tried attaching nvim before initializing it, and/or setup api'
    )
  }
  const nvim = nvimInstance!
  if (nvim.attached) {
    console.warn('Already attached nvim')
  }

  nvimApi!.uiAttach(clientSize.width, clientSize.height, nvimOptions)
  // highlight groups defined before nvim_ui_attach get reset
  nvimApi!.command(`highlight ${Highlight.Undercurl} gui=undercurl`)
  nvimApi!.command(`highlight ${Highlight.Underline} gui=underline`)
  nvim.attached = true
}

const createAndSetupNvimInstance = (useWsl: boolean, nvimBinary?: string) => {
  if (nvimInstance) {
    console.log('Already created vim instance???')
  }
  const pipeName = getPipeName('veonim-instance')
  const proc = spawnNvimInstance(pipeName, useWsl, nvimBinary)

  nvimInstance = { proc, pipeName, attached: false }

  proc.on('error', (e: any) => console.error(`nvim err ${e}`))
  proc.stdout!.on('error', (e: any) =>
    console.error(`nvim stdout err ${JSON.stringify(e)}`)
  )
  proc.stdin!.on('error', (e: any) =>
    console.error(`nvim stdin err ${JSON.stringify(e)}`)
  )
  proc.on('exit', (c: any) => onExitFn(c))

  attachNvim()
  setupNvimInstance()
}

export const createNvim = async (
  useWsl: boolean,
  nvimBinaryPath?: string,
  dir?: string
) => {
  createAndSetupNvimInstance(useWsl, nvimBinaryPath)
  const { pipeName: path } = nvimInstance!

  workerInstance = Worker('instance', {
    workerData: { nvimPath: path },
  })
  setupNvimOnHandlers()

  dir && (await nvimApi!.command(`cd ${dir}`))
}

export const getWorkerInstance = () => workerInstance

const onExit = (fn: ExitFn) => {
  onExitFn = fn
}
onExit(() => {
  return remote.app.quit()
})

export const onRedraw = (fn: RedrawFn) => {
  nvimApi!.on('notification', (method: string, args) =>
    method === 'redraw' ? fn(args) : {}
  )
}

export const input = (keys: string) => {
  nvimApi!.input(keys)
  if (document.activeElement === document.body) {
    document.getElementById('keycomp-textarea')?.focus()
  }
}
export const getMode = async () => {
  const mode = await nvimApi?.mode
  console.log(`getmode: ${mode}`)
  return mode as { mode: string; blocking: boolean }
  // (await nvimApi!.mode) as { mode: string; blocking: boolean }
}

export const resizeGrid = (grid: number, width: number, height: number) =>
  nvimApi?.uiTryResizeGrid(grid, width, height)

export const resize = (width: number, height: number) => {
  merge(clientSize, { width, height })
  nvimApi?.uiTryResize(width, height)
}

export const getColor = async (id: number) => {
  const { foreground, background } = (await nvimApi?.getHighlightById(
    id,
    true
  )) as Color
  return {
    fg: asColor(foreground),
    bg: asColor(background),
  }
}
