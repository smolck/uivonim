import { asColor, merge, getPipeName } from '../../common/utils'
import Worker from '../workers/messaging/worker'
import { startupFuncs, startupCmds } from '../neovim/startup'
import { Color, Highlight } from '../neovim/types'
import { ChildProcess, spawn } from 'child_process'
import InstanceApi, { InstanceApi as InstanceApiType } from '../core/instance-api'
import * as neovim from 'neovim'
import { BrowserWindow } from 'electron'

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
  // TODO(smolck): Better default than this? Shouldn't really matter I guess . . .
  width: 80,
  height: 80,
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

  const workerInstance = new Worker('instance', {
    workerData: { nvimPath: path },
  })

  dir && (await nvimApi!.command(`cd ${dir}`))
  return { workerInstance, nvimInstance, nvimApi }
}

// TODO(smolck): Second arg type?
const masterControlInternal =
  (winRef: BrowserWindow, 
   { nvimInstance, nvimApi, workerInstance }: any) => {
  const instanceApi = InstanceApi(workerInstance, winRef)

  return {
    nvimInstance,
    instanceApi,
    // TODO(smolck): Does this cast work as I want it to?
    // @ts-ignore
    workerInstanceId: () => workerInstance as number,

    onRedraw: (fn: RedrawFn) =>
      nvimApi.on('notification',
                 (method: string, args: any) => method === 'redraw' ? fn(args) : {}),

    // TODO(smolck): Need (?) to tell the render thread to do this when called
    /* if (document.activeElement === document.body) {
      document.getElementById('keycomp-textarea')?.focus()
    }*/
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

const MasterControl = async (winRef: BrowserWindow, opts: { useWsl: boolean, nvimBinaryPath?: string, dir?: string }) => {
  return masterControlInternal(winRef, await createNvim(
    opts.useWsl, opts.nvimBinaryPath, opts.dir))
}

export default MasterControl
// `masterControlInternal` is used so that `MasterControl` isn't a Promise type.
export type MasterControl = ReturnType<typeof masterControlInternal>
