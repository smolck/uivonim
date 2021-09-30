import { app } from 'electron'
import { asColor, merge, getPipeName } from '../../common/utils'
import Worker, { Worker as WorkerType } from '../workers/messaging/worker'
import { Color, Highlight } from '../neovim/types'
import { ChildProcess, spawn } from 'child_process'
import InstanceApi from '../core/instance-api'
import * as neovim from 'neovim'
import { BrowserWindow } from 'electron'
import { resolve } from 'path'

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
  // Arbitrary default width & height
  width: 80,
  height: 80,
}

let onExitFn: ExitFn = () => {}

const spawnNvimInstance = (
  pipeName: string,
  useWsl: boolean,
  nvimBinary?: string
) => {
  // TODO(smolck): See https://github.com/smolck/uivonim/issues/411#issue-1011598155, runtime
  // files are in a different place when app is packaged so that's why this exists. Feels kinda
  // hacky though.
  const runtimeDir = app.isPackaged ? resolve(__dirname, '..', '..', 'runtime') : resolve(__dirname, '..', '..', '..', 'runtime')
  const args = [
    '--cmd',
    `let $PATH .= ':${runtimeDir}/${process.platform}' | let &runtimepath .= ',${runtimeDir}'`,
    '--cmd',
    `com! -nargs=+ -range -complete=custom,UivonimCmdCompletions Uivonim call Uivonim(<f-args>)`,
    '--cmd',
    `source ${runtimeDir}/uivonim.vim`,
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
  if (!nvimApi)
    throw new Error(
      "Couldn't attach to neovim instance; this shouldn't happen."
    )
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

  dir && (await nvimApi!.command(`cd ${dir}`))
  return { workerInstance, nvimInstance, nvimApi }
}

const masterControlInternal = (
  winRef: BrowserWindow,
  {
    nvimInstance,
    nvimApi,
    workerInstance,
  }: {
    nvimInstance: NvimInstance
    nvimApi: neovim.Neovim
    workerInstance: WorkerType
  }
) => {
  const instanceApi = InstanceApi(workerInstance, winRef)

  return {
    nvimInstance,
    instanceApi,

    onExit: (fn: ExitFn) => (onExitFn = fn),
    onRedraw: (fn: RedrawFn) =>
      nvimApi.on('notification', (method: string, args: any) => {
        method === 'redraw' ? fn(args) : {}
      }),

    input: (keys: string) => nvimApi.input(keys),
    getMode: async () => {
      const mode = await nvimApi.mode
      console.log(`getmode: ${mode}`)
      return mode as { mode: string; blocking: boolean }
    },
    resizeGrid: (grid: number, width: number, height: number) => {
      nvimApi.uiTryResizeGrid(grid, width, height)
    },

    resize: (width: number, height: number) => {
      merge(clientSize, { width, height })
      nvimApi.uiTryResize(width, height)
    },

    getColor: async (id: number) => {
      const { foreground, background } = (await nvimApi.getHighlightById(
        id,
        true
      )) as Color
      return {
        fg: asColor(foreground),
        bg: asColor(background),
      }
    },
  }
}

const MasterControl = async (
  winRef: BrowserWindow,
  opts: { useWsl: boolean; nvimBinaryPath?: string; dir?: string }
) => {
  return masterControlInternal(
    winRef,
    await createNvim(opts.useWsl, opts.nvimBinaryPath, opts.dir)
  )
}

export default MasterControl
// `masterControlInternal` is used so that this isn't a Promise type.
export type MasterControl = ReturnType<typeof masterControlInternal>
