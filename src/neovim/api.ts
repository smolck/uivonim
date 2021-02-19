import { simplifyPath, is } from '../support/utils'
import { basename, dirname } from 'path'
import {
  Keymap,
  BufferInfo,
  BufferOption,
  BufferType,
  BufferHide,
  BufferEvent,
  GenericCallback,
  VimOption,
} from '../neovim/types'
import { Autocmds } from '../neovim/startup'
import { normalizeVimMode } from '../support/neovim-utils'
import { EventEmitter } from 'events'
import CreateVimState from '../neovim/state'
import * as neovim from 'neovim'
import { workerData } from '../messaging/worker-client'

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
type Neovim = {
  // onAction: (name: string, fn: (...args: any[]) => void) => void
  onAction: (event: string, cb: GenericCallback) => void
  jumpTo: (line: number, column?: number, path?: string) => Promise<void>
  getAndParseKeymap: (mode: string) => Promise<Keymap>
  state: typeof state
  watchState: typeof watchState
  onStateChange: typeof onStateChange
  onStateValue: typeof onStateValue
  untilStateValue: typeof untilStateValue
  listBuffersWithInfo: () => Promise<BufferInfo[]>
  highlightSearchPattern: (pattern: string, id?: number) => Promise<number[]>
  removeHighlightSearch: (id: number, pattern?: string) => Promise<boolean>

  g: typeof Proxy
  on: OnEvent

  addShadowBuffer: (name: string) => Promise<neovim.Buffer>
  isTerminalBuffer: (buffer: neovim.Buffer) => Promise<boolean>
  readonlyOptions: VimOption
}

const registeredEventActions = new Set<string>()
const events = [...registeredEventActions.values()].join('\\n')
const highlightedIds = new Set<number>()
const options = new Map<string, any>()
const emptyObject: { [index: string]: any } = Object.create(null)
const documentFiletypes = new Map<number, string>()

const nvimInstance = neovim.attach({ socket: workerData.nvimPath })

const getOption = async (name: string) => {
  const optionValue = await nvimInstance.getOption(name)
  options.set(name, optionValue)
  return optionValue
}

const addBuffer = async (path: string) => {
  const bufs = await nvimInstance.buffers
  const existingBuffer = bufs.find((m) => m.name === path)
  if (existingBuffer) return existingBuffer

  // TODO: use nvim_create_buf() when it is available
  nvimInstance.command(`badd ${path}`)
  const buffer = (await nvimInstance.buffers).find(async (b) =>
    (await b.name).endsWith(path)
  )
  if (!buffer)
    throw new Error(
      `buffers.add(${path}) failed. probably we were not able to find the buffer after adding it`
    )
  return buffer
}

const nvim: Neovim = {
  state,
  watchState,
  onStateChange,
  onStateValue,
  untilStateValue,

  g: new Proxy(emptyObject, {
    get: async (_t, name: string) => {
      const val = await nvimInstance.getVar(name as string).catch((e) => e)
      const err =
        is.array(val) && is.string(val[1]) && /Key (.*?)not found/.test(val[1])
      return err ? undefined : val
    },
    set: (_t, name: string, val: any) => (nvimInstance.setVar(name, val), true),
  }),

  on: new Proxy(Object.create(null), {
    get: (_, event: BufferEvents) => (fn: any) => watchers.events.on(event, fn),
  }),

  readonlyOptions: new Proxy(Object.create(null), {
    get: (_, key: string) =>
      options.has(key) ? Promise.resolve(options.get(key)) : getOption(key),
  }),

  onAction: (event: string, cb: GenericCallback) => {
    watchers.actions.on(event, cb)
    registeredEventActions.add(event)
    nvimInstance.command(`let g:uvn_cmd_completions .= "${event}\\n"`)
  },
  // TODO(smolck): Test this (and others)
  jumpTo: async (line, column, path) => {
    // TODO(smolck): Should this be unconditionally done if there's a path?
    if (path)
      nvimInstance.command(`e ${path}`)

      // line: 1-index based
      // column: 0-index based
    ;(await nvimInstance.window).cursor = [line + 1, column || 0]
  },
  getAndParseKeymap: async (mode: string = 'n') =>
    (await nvimInstance.getKeymap(mode)).reduce((res: Keymap, m: any) => {
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
    const bufs = await nvimInstance.buffers
    const currentBufferId = (await nvimInstance.buffer).id

    const bufInfo = await Promise.all(
      bufs.map(async (b) => ({
        name: await b.name,
        current: b.id === currentBufferId,
        modified: (await b.getOption(BufferOption.Modified)) as boolean,
        listed: (await b.getOption(BufferOption.Listed)) as string,
        terminal:
          (await b.getOption(BufferOption.Type)) === BufferType.Terminal,
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

    const [results, errors] = await nvimInstance.callAtomic(calls)
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

    const [results, errors] = await nvimInstance.callAtomic(calls)
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
  isTerminalBuffer: async (buffer: neovim.Buffer) =>
    (await buffer.getOption(BufferOption.Type)) === BufferType.Terminal,
} as Neovim

const registerFiletype = (bufnr: number, filetype: string) => {
  documentFiletypes.set(bufnr, filetype)
}

nvimInstance.command(`let g:uvn_cmd_completions .= "${events}\\n"`)

nvimInstance.subscribe('uivonim')
nvimInstance.subscribe('uivonim-state')
nvimInstance.subscribe('uivonim-position')
nvimInstance.subscribe('uivonim-g')
nvimInstance.subscribe('uivonim-autocmd')
nvimInstance.on('notification', (method, args) => {
  switch (method) {
    case 'uivonim':
      watchers.actions.emit(args[0], ...(args[1] || []))
      break
    case 'uivonim-state':
      Object.assign(state, args[0])
      break
    case 'uivonim-position':
      Object.assign(state, args[0])
      break
    case 'uivonim-g':
      watchers.internal.emit(`gvar::${args[0]}`, args[1].new)
      break
    case 'uivonim-autocmd':
      if (args[0] === 'FileType') registerFiletype(args[1], args[2])
      watchers.autocmds.emit(args[0], ...args.slice(1))
      break
    default:
      console.log(method, ...args)
  }
})

nvimInstance.subscribe('nvim_buf_detach_event')
nvimInstance.on('nvim_buf_detach_event', (args: any[]) => {
  watchers.bufferEvents.emit(`detach:${args[0].id}`)
})

nvimInstance.subscribe('nvim_buf_changedtick_event')
nvimInstance.on('nvim_buf_changedtick_event', (args: any[]) => {
  const [extContainerData, changedTick] = args
  const bufId = extContainerData.id
  watchers.bufferEvents.emit(`changedtick:${bufId}`, changedTick)
})

nvimInstance.subscribe('nvim_buf_lines_event')
nvimInstance.on('nvim_buf_lines_event', (args: any[]) => {
  const [
    extContainerData,
    changedTick,
    firstLine,
    lastLine,
    lineData,
    more,
  ] = args
  const bufId = extContainerData.id

  watchers.bufferEvents.emit(`change:${bufId}`, {
    filetype: documentFiletypes.get(bufId),
    changedTick,
    firstLine,
    lastLine,
    lineData,
    more,
  })
})

// Refresh uivonim state
nvimInstance
  .call('UivonimState')
  .then((newState) => Object.assign(state, newState))
watchers.events.emit('bufLoad')

type RegisterAutocmd = {
  [Key in Autocmds]: (fn: (...arg: any[]) => void) => void | any
}

const autocmd: RegisterAutocmd = new Proxy(Object.create(null), {
  get: (_, event: Autocmds) => (fn: any) => watchers.autocmds.on(event, fn),
})

autocmd.CompleteDone((word) => watchers.events.emit('completion', word))
autocmd.CursorMoved(() => watchers.events.emit('cursorMove'))
autocmd.CursorMovedI(() => watchers.events.emit('cursorMoveInsert'))
autocmd.BufAdd((bufId) => watchers.events.emit('bufOpen', bufId))
autocmd.BufEnter((bufId) => watchers.events.emit('bufLoad', bufId))
autocmd.BufWritePre((bufId) => watchers.events.emit('bufWritePre', bufId))
autocmd.BufWritePost((bufId) => watchers.events.emit('bufWrite', bufId))
autocmd.BufWipeout((bufId) => watchers.events.emit('bufClose', bufId))
autocmd.InsertEnter(() => watchers.events.emit('insertEnter'))
autocmd.InsertLeave(() => watchers.events.emit('insertLeave'))
autocmd.FileType((_, filetype: string) =>
  watchers.events.emit('filetype', filetype)
)
autocmd.OptionSet((name: string, value: any) => {
  options.set(name, value)
  watchers.internal.emit(`option-set::${name}`, value)
})

autocmd.TextChanged((revision) => {
  state.revision = revision - 0
  watchers.events.emit('bufChange', nvimInstance.buffer)
})

autocmd.TextChangedI((revision) => {
  state.revision = revision - 0
  watchers.events.emit('bufChangeInsert', nvimInstance.buffer)
})

// TODO: i think we should just determine this from render events
autocmd.WinEnter((id: number) => watchers.events.emit('winEnter', id))

export default Object.assign(nvimInstance, nvim)
