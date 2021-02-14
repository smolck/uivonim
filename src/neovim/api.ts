import { simplifyPath, is } from '../support/utils'
import { basename, dirname } from 'path'
import { Keymap, BufferInfo, BufferOption, BufferType, BufferHide, BufferEvent, GenericCallback } from '../neovim/types'
import { normalizeVimMode } from '../support/neovim-utils'
import { EventEmitter } from 'events'
import CreateVimState from '../neovim/state'
import * as neovim from 'neovim'
import {
  workerData,
} from '../messaging/worker-client'

if (!workerData || !workerData.nvimPath)
  throw new Error(
    `can't connect to nvim! workerData is missing "nvimPath" ${JSON.stringify(
      workerData
    )}`
  )

const {
  state,
  watchState,
  onStateChange,
  onStateValue,
  untilStateValue,
} = CreateVimState('main')

const watchers = {
  actions: new EventEmitter(),
  events: new EventEmitter(),
  autocmds: new EventEmitter(),
  bufferEvents: new EventEmitter(),
  internal: new EventEmitter(),
}

type BufferEvents = keyof BufferEvent
type RemoveListener = () => void
type OnEvent = {
  [Key in BufferEvents]: (
    fn: (value: BufferEvent[Key]) => void
  ) => RemoveListener
}
type Neovim = neovim.NeovimClient & {
  // onAction: (name: string, fn: (...args: any[]) => void) => void
  onAction: (event: string, cb: GenericCallback) => void
  jumpTo: (line: number, column?: number, path?: string) => Promise<void>
  getAndParseKeymap: (mode: string) => Promise<Keymap>
  state: typeof state,
  watchState: typeof watchState
  onStateChange: typeof onStateChange,
  onStateValue: typeof onStateValue,
  untilStateValue: typeof untilStateValue,
  listBuffersWithInfo: () => Promise<BufferInfo[]>
  highlightSearchPattern: (pattern: string, id?: number) => Promise<number[]>
  removeHighlightSearch: (id: number, pattern?: string) => Promise<boolean>

  g: typeof Proxy
  on: OnEvent

  addShadowBuffer: (name: string) => Promise<neovim.Buffer>
  isTerminalBuffer: (buffer: neovim.Buffer) => Promise<boolean>
}

const registeredEventActions = new Set<string>()
const highlightedIds = new Set<number>()
const emptyObject: { [index: string]: any } = Object.create(null)

const addBuffer = async (path: string) => {
  const bufs = await nvim.buffers
  const existingBuffer = bufs.find((m) => m.name === path)
  if (existingBuffer) return existingBuffer

  // TODO: use nvim_create_buf() when it is available
  nvim.command(`badd ${path}`)
  const buffer = (await nvim.buffers).find(async (b) => (await b.name).endsWith(path))
  if (!buffer)
    throw new Error(
      `buffers.add(${path}) failed. probably we were not able to find the buffer after adding it`
    )
  return buffer
}

const nvim: Neovim = {
  ...neovim.attach({ socket: workerData.nvimPath }), 
  state,
  watchState,
  onStateChange,
  onStateValue,
  untilStateValue,

  g: new Proxy(emptyObject, {
    get: async (_t, name: string) => {
      const val = await nvim.getVar(name as string).catch((e) => e)
      const err =
        is.array(val) && is.string(val[1]) && /Key (.*?)not found/.test(val[1])
      return err ? undefined : val
    },
    set: (_t, name: string, val: any) => (nvim.setVar(name, val), true),
  }),

  on: new Proxy(Object.create(null), {
    get: (_, event: BufferEvents) => (fn: any) => watchers.events.on(event, fn),
  }),

  onAction: (event: string, cb: GenericCallback) => {
    watchers.actions.on(event, cb)
    registeredEventActions.add(event)
    nvim.command(`let g:uvn_cmd_completions .= "${event}\\n"`)
  },
  // TODO(smolck): Test this (and others)
  jumpTo: async (line, column, path) => {
    // TODO(smolck): Should this be unconditionally done if there's a path?
    if (path) nvim.command(`e ${path}`)

    // line: 1-index based
    // column: 0-index based
    ;(await nvim.window).cursor = [line + 1, column || 0]
  },
  getAndParseKeymap: async (mode: string = 'n') => (await nvim.getKeymap(mode)).reduce((res: Keymap, m: any) => {
    const { lhs, rhs, sid, buffer, mode } = m

    res.set(lhs, {
      lhs,
      rhs,
      sid,
      buffer,
      mode: normalizeVimMode(mode),
      // vim does not have booleans. these values are returned as either 0 or 1
      expr: !!m.expr,
      silent: !!m.silent,
      nowait: !!m.nowait,
      noremap: !!m.noremap,
    })

    return res
  }, new Map()),
  listBuffersWithInfo: async () => {
    const bufs = await nvim.buffers
    const currentBufferId = (await nvim.buffer).id

    const bufInfo = await Promise.all(
      bufs.map(async (b) => ({
        name: await b.name,
        current: b.id === currentBufferId,
        modified: await b.getOption(BufferOption.Modified) as boolean,
        listed: await b.getOption(BufferOption.Listed) as string,
        terminal: await b.getOption(BufferOption.Type) === BufferType.Terminal,
      }))
    )

    if (!bufInfo) return []

    return bufInfo
      .filter((m) => m.listed && !m.current)
      .map(({ name, modified, terminal }) => ({
        name,
        modified,
        terminal,
        base: basename(name),
        dir: simplifyPath(dirname(name), state.cwd),
      }))
      .map((m, ix, arr) => ({
        ...m,
        duplicate: arr.some((n, ixf) => ixf !== ix && n.base === m.base),
      }))
      .map((m) => ({ ...m, name: m.duplicate ? `${m.dir}/${m.base}` : m.base }))
  },
  removeHighlightSearch: async (id: number, pattern?: string) => {
    const idExistsAndShouldBeRemoved = highlightedIds.has(id)
    highlightedIds.delete(id)
    if (!idExistsAndShouldBeRemoved) return true

    const calls = [['nvim_call_function', ['matchdelete', [id]]]]

    if (pattern) calls.push(['nvim_command', [pattern]])

    const [results, errors] = await nvim.callAtomic(calls)
    // TODO(smolck): See TODO in `highlightSearchPattern` below
    if (errors /*&& errors.length*/) {
      console.error('neovim-api.removeHighlightSearch error:', errors)
      return false
    }

    return !results[0]
  },
  highlightSearchPattern: async (pattern: string, id?: number) => {
    const addArgs = ['Search', pattern, 0]
    if (id) addArgs.push(id)

    const calls = [['nvim_call_function', ['matchadd', addArgs]]]

    if (id && highlightedIds.has(id)) {
      calls.unshift(['nvim_call_function', ['matchdelete', [id]]])
    }

    const [results, errors] = await nvim.callAtomic(calls)
    // TODO(smolck): Umm maybe the neovim node-client is wrong with the return
    // type here? (i.e. the function is wrong)
    if (errors /*&& errors.length*/) {
      return console.error('neovim-api.highlightSearchPattern error:', errors)
    }

    const matchAddResult = results[results.length - 1]
    highlightedIds.add(matchAddResult)
    return matchAddResult
  },
  /** Add a shadow buffer used to render GUI elements on top of */
  addShadowBuffer: async (name: string) => {
    const buffer = await addBuffer(name)

    buffer.setOption(BufferOption.Type, BufferType.NonFile)
    buffer.setOption(BufferOption.Hidden, BufferHide.Hide)
    buffer.setOption(BufferOption.Listed, false)
    buffer.setOption(BufferOption.Modifiable, false)
    buffer.setOption(BufferOption.Filetype, 'veonim-shadow-buffer')

    return buffer
  },
  isTerminalBuffer: async (buffer: neovim.Buffer) => await buffer.getOption(BufferOption.Type) === BufferType.Terminal,
} as Neovim


const subscribe = (event: string, fn: (data: any) => void) => {
  nvim.on(event, fn)
  nvim.subscribe(event)
}

export default nvim
