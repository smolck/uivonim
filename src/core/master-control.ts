import {
  asColor,
  onFnCall,
  merge,
  prefixWith,
  getPipeName,
} from '../support/utils'
import Worker from '../messaging/worker'
import MsgpackStreamDecoder from '../messaging/msgpack-decoder'
import MsgpackStreamEncoder from '../messaging/msgpack-encoder'
import { startupFuncs, startupCmds } from '../neovim/startup'
import { Api, Prefixes } from '../neovim/protocol'
import { Color, Highlight } from '../neovim/types'
import { ChildProcess, spawn } from 'child_process'
import SetupRPC from '../messaging/rpc'
import { setupNvimStuff } from '../core/instance-api'
import { remote } from 'electron'

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
const prefix = prefixWith(Prefixes.Core)
let nvimInstance: NvimInstance | undefined = undefined
let workerInstance: any = undefined
const msgpackDecoder = new MsgpackStreamDecoder()
const msgpackEncoder = new MsgpackStreamEncoder()

const spawnNvimInstance = (
  pipeName: string,
  useWsl: boolean,
  nvimBinary?: string
) => {
  const args = [
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
  if (!nvimInstance) {
    throw new Error('INITIALIZE FIRST!!!!')
  }
  const { proc, attached } = nvimInstance

  msgpackEncoder.pipe(proc.stdin!)

  // don't kill decoder stream when this stdout stream ends (need for other stdouts)
  proc.stdout!.pipe(msgpackDecoder, { end: false })

  // sending resize (even of the same size) makes vim instance clear/redraw screen
  // this is how to repaint the UI with the new vim instance. not the most obvious...
  if (attached) api.uiTryResize(clientSize.width, clientSize.height)
}

const attachNvim = () => {
  if (!nvimInstance) {
    console.warn('Tried attaching nvim before initializing it')
  }
  const nvim = nvimInstance!
  if (nvim.attached) {
    console.warn('Already attached nvim')
  }

  api.uiAttach(clientSize.width, clientSize.height, nvimOptions)
  // highlight groups defined before nvim_ui_attach get reset
  api.command(`highlight ${Highlight.Undercurl} gui=undercurl`)
  api.command(`highlight ${Highlight.Underline} gui=underline`)
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
  // const { id, path } = await create(useWsl, dir)
  createAndSetupNvimInstance(useWsl, nvimBinaryPath)
  const { pipeName: path } = nvimInstance!

  api.command(`${startupFuncs()} | ${startupCmds}`)
  dir && api.command(`cd ${dir}`)

  workerInstance = Worker('instance', {
    workerData: { nvimPath: path },
  })
  setupNvimStuff()
  // TODO(smolck):
  // nvimInstance.active = true
  // nvimInstance.nameFollowsCwd = !!dir,
}

const { notify, request, onEvent, onData } = SetupRPC((m) =>
  msgpackEncoder.write(m)
)
msgpackDecoder.on('data', ([type, ...d]: [number, any]) => onData(type, d))

const req: Api = onFnCall((name: string, args: any[] = []) =>
  request(prefix(name), args)
)
const api: Api = onFnCall((name: string, args: any[]) =>
  notify(prefix(name), args)
)

export const getWorkerInstance = () => workerInstance

const onExit = (fn: ExitFn) => {
  onExitFn = fn
}
onExit(() => {
  return remote.app.quit()
})

export const onRedraw = (fn: RedrawFn) => onEvent('redraw', fn)
export const input = (keys: string) => {
  api.input(keys)
  if (document.activeElement === document.body) {
    document.getElementById('keycomp-textarea')?.focus()
  }
}
export const getMode = () =>
  req.getMode() as Promise<{ mode: string; blocking: boolean }>

export const resizeGrid = (grid: number, width: number, height: number) =>
  api.uiTryResizeGrid(grid, width, height)

export const resize = (width: number, height: number) => {
  merge(clientSize, { width, height })
  api.uiTryResize(width, height)
}

export const getColor = async (id: number) => {
  const { foreground, background } = (await req.getHlById(id, true)) as Color
  return {
    fg: asColor(foreground),
    bg: asColor(background),
  }
}
