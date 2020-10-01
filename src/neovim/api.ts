import {
  VimOption,
  BufferEvent,
  HyperspaceCoordinates,
  BufferType,
  BufferHide,
  BufferOption,
  Buffer,
  Window,
  Tabpage,
  GenericCallback,
  BufferInfo,
  Keymap,
} from '../neovim/types'
import {
  Api,
  ExtContainer,
  Prefixes,
  Buffer as IBuffer,
  Window as IWindow,
  Tabpage as ITabpage,
} from '../neovim/protocol'
import {
  is,
  onFnCall,
  onProp,
  prefixWith,
  simplifyPath,
  remove,
  rename,
} from '../support/utils'
import {
  workerData,
  request as requestFromUI,
} from '../messaging/worker-client'
import ConnectMsgpackRPC from '../messaging/msgpack-transport'
import * as TextEditPatch from '../neovim/text-edit-patch'
import { normalizeVimMode } from '../support/neovim-utils'
import { Functions } from '../neovim/function-types'
import { Autocmds } from '../neovim/startup'
import CreateVimState from '../neovim/state'
import { Position } from '../neovim/types'
import { basename, dirname } from 'path'
import { EventEmitter } from 'events'

const prefix = {
  core: prefixWith(Prefixes.Core),
  buffer: prefixWith(Prefixes.Buffer),
  window: prefixWith(Prefixes.Window),
  tabpage: prefixWith(Prefixes.Tabpage),
}

if (!workerData || !workerData.nvimPath)
  throw new Error(
    `can't connect to nvim! workerData is missing "nvimPath" ${JSON.stringify(
      workerData
    )}`
  )
const { notify, request, onEvent } = ConnectMsgpackRPC(workerData.nvimPath)

const registeredEventActions = new Set<string>()
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

const req = {
  core: onFnCall((name: string, args: any[] = []) =>
    request(prefix.core(name), args)
  ) as Api,
  buf: onFnCall((name: string, args: any[] = []) =>
    request(prefix.buffer(name), args)
  ) as IBuffer,
  win: onFnCall((name: string, args: any[] = []) =>
    request(prefix.window(name), args)
  ) as IWindow,
  tab: onFnCall((name: string, args: any[] = []) =>
    request(prefix.tabpage(name), args)
  ) as ITabpage,
}

const api = {
  core: onFnCall((name: string, args: any[]) =>
    notify(prefix.core(name), args)
  ) as Api,
  buf: onFnCall((name: string, args: any[]) =>
    notify(prefix.buffer(name), args)
  ) as IBuffer,
  win: onFnCall((name: string, args: any[]) =>
    notify(prefix.window(name), args)
  ) as IWindow,
  tab: onFnCall((name: string, args: any[]) =>
    notify(prefix.tabpage(name), args)
  ) as ITabpage,
}

// trying to do dynamic introspection (obj vs arr) messy with typings. (also a bit slower)
const as = {
  buf: (p: Promise<ExtContainer>): Promise<Buffer> =>
    p.then((e) => Buffer(e.id)),
  bufl: (p: Promise<ExtContainer[]>): Promise<Buffer[]> =>
    p.then((m) => m.map((e) => Buffer(e.id))),
  win: (p: Promise<ExtContainer>): Promise<Window> =>
    p.then((e) => Window(e.id)),
  winl: (p: Promise<ExtContainer[]>): Promise<Window[]> =>
    p.then((m) => m.map((e) => Window(e.id))),
  tab: (p: Promise<ExtContainer>): Promise<Tabpage> =>
    p.then((e) => Tabpage(e.id)),
  tabl: (p: Promise<ExtContainer[]>): Promise<Tabpage[]> =>
    p.then((m) => m.map((e) => Tabpage(e.id))),
}

const subscribe = (event: string, fn: (data: any) => void) => {
  onEvent(event, fn)
  api.core.subscribe(event)
}

const options = new Map<string, any>()

const getOption = async (name: string) => {
  const optionValue = await req.core.getOption(name)
  options.set(name, optionValue)
  return optionValue
}

const readonlyOptions: VimOption = new Proxy(Object.create(null), {
  get: (_, key: string) =>
    options.has(key) ? Promise.resolve(options.get(key)) : getOption(key),
})

const getOptionCurrentAndFuture = (name: string, fn: (value: any) => void) => {
  Reflect.get(readonlyOptions, name).then(fn)
  const key = `option-set::${name}`
  watchers.internal.on(key, fn)
  return () => watchers.internal.removeListener(key, fn)
}

const getVarCurrentAndFuture = (name: string, fn: (value: any) => void) => {
  Reflect.get(g, name).then(fn)
  cmd(`call dictwatcheradd(g:, '${name}', 'UivonimGChange')`)
  const key = `gvar::${name}`
  watchers.internal.on(key, fn)
  return () => {
    cmd(`call dictwatcherdel(g:, '${name}', 'UivonimGChange')`)
    watchers.internal.removeListener(key, fn)
  }
}

const cmd = (command: string) => api.core.command(command)
const cmdOut = (command: string) => req.core.commandOutput(command)
const expr = (expression: string) => req.core.eval(expression)
const call: Functions = onFnCall((name, args) =>
  req.core.callFunction(name, args)
)
const feedkeys = (keys: string, mode = 'm', escapeCSI = false) =>
  req.core.feedkeys(keys, mode, escapeCSI)
const normal = (keys: string) => cmd(`norm! "${keys.replace(/"/g, '\\"')}"`)
const callAtomic = (calls: any[]) => req.core.callAtomic(calls)
const onAction = (event: string, cb: GenericCallback) => {
  watchers.actions.on(event, cb)
  registeredEventActions.add(event)
  cmd(`let g:uvn_cmd_completions .= "${event}\\n"`)
}

const highlightedIds = new Set<number>()

const removeHighlightSearch = async (id: number, pattern?: string) => {
  const idExistsAndShouldBeRemoved = highlightedIds.has(id)
  highlightedIds.delete(id)
  if (!idExistsAndShouldBeRemoved) return true

  const calls = [['nvim_call_function', ['matchdelete', [id]]]]

  if (pattern) calls.push(['nvim_command', [pattern]])

  const [results, errors] = await callAtomic(calls)
  if (errors && errors.length) {
    console.error('neovim-api.removeHighlightSearch error:', errors)
    return false
  }

  return !results[0]
}

const highlightSearchPattern = async (pattern: string, id?: number) => {
  const addArgs = ['Search', pattern, 0]
  if (id) addArgs.push(id)

  const calls = [['nvim_call_function', ['matchadd', addArgs]]]

  if (id && highlightedIds.has(id)) {
    calls.unshift(['nvim_call_function', ['matchdelete', [id]]])
  }

  const [results, errors] = await callAtomic(calls)
  if (errors && errors.length) {
    return console.error('neovim-api.highlightSearchPattern error:', errors)
  }

  const matchAddResult = results[results.length - 1]
  highlightedIds.add(matchAddResult)
  return matchAddResult
}

// TODO; nvim_get_color_by_name does not work yet
// const getColorByName = (name: string) => req.core.getColorByName(name)
const getColorByName = (name: string) => req.core.getHlByName(name, true)
const getCurrentLine = () => req.core.getCurrentLine()

const parseKeymap = (keymap: any): Keymap =>
  keymap.reduce((res: Keymap, m: any) => {
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
  }, new Map())

const getKeymap = async (mode = 'n') => {
  const map = await req.core.getKeymap(mode)
  return parseKeymap(map)
}

const getNamedBuffers = async () => {
  const bufs = await buffers.list()
  return Promise.all(
    bufs.map(async (b) => ({
      buffer: b,
      name: await b.name,
    }))
  )
}

const loadBuffer = async (file: string): Promise<boolean> => {
  const targetBuffer = await buffers.find(file)
  if (!targetBuffer) return false

  api.core.setCurrentBuf(targetBuffer.id as any)
  return true
}

type JumpOpts = HyperspaceCoordinates & { openBufferFirst: boolean }

const jumpToPositionInFile = async ({
  line,
  path,
  column,
  openBufferFirst,
}: JumpOpts) => {
  if (openBufferFirst && path) cmd(`e ${path}`)
  // nvim_win_set_cursor params
  // line: 1-index based
  // column: 0-index based
  current.window.setCursor(line + 1, column || 0)
}

const jumpTo = async ({ line, column, path }: HyperspaceCoordinates) => {
  const bufferLoaded = path
    ? path === state.file || path === state.absoluteFilepath
    : true
  jumpToPositionInFile({ line, column, path, openBufferFirst: !bufferLoaded })
}

const systemAction = (event: string, cb: GenericCallback) =>
  watchers.actions.on(event, cb)

const buffers = {
  /** Get a buffer using a filesystem path. If buffer is not yet in buffer list it will be added to the list */
  getBufferFromPath: async (path: string): Promise<Buffer> => {
    const bufs = await getNamedBuffers()
    const found = bufs.find((b) => b.name === path)
    return found ? found.buffer : buffers.add(path)
  },
  /** Create untitled buffer and open it up. Also optionally set filetype and initial contents */
  create: async ({ filetype = '', content = '' } = {}) => {
    const bufid = await call.bufnr('[No Name]', 420)
    cmd(`b ${bufid}`)
    const buffer = Buffer(bufid)
    if (filetype) buffer.setOption(BufferOption.Filetype, filetype)
    if (content) buffer.append(0, content.split('\n'))
    return buffer
  },
  /** List all buffers */
  list: () => as.bufl(req.core.listBufs()),
  /** Open a buffer from a filesystem path in the current window */
  open: async (path: string) => {
    const loaded = await loadBuffer(path)
    if (loaded) return true

    cmd(`badd ${path}`)
    return loadBuffer(path)
  },
  /** Find a buffer from a filesystem path */
  find: async (path: string) => {
    const buffers = await getNamedBuffers()
    // it appears that buffers name will have a fullpath, like
    // `/Users/anna/${name}` so we will try to substring match
    // the end of the name
    const found = buffers.find((b) => b.name.endsWith(path)) || {
      buffer: dummy.buf,
    }
    return found.buffer
  },
  /** Add a new buffer to the buffer list from the given filesystem path */
  add: async (path: string) => {
    const bufs = await getNamedBuffers()
    const existingBuffer = bufs.find((m) => m.name === path)
    if (existingBuffer) return existingBuffer.buffer

    // TODO: use nvim_create_buf() when it is available
    cmd(`badd ${path}`)
    const buffer = await buffers.find(path)
    if (!buffer)
      throw new Error(
        `buffers.add(${path}) failed. probably we were not able to find the buffer after adding it`
      )
    return buffer
  },
  /** Remove a buffer from the buffer list */
  remove: (path: string) => cmd(`bdelete ${path}`),
  /** Rename buffer and file given old and new paths. This affects the filesystem */
  rename: async (oldPath: string, newPath: string) => {
    buffers.remove(oldPath)
    await rename(oldPath, newPath)
    return buffers.add(newPath)
  },
  /** Delete buffer and file at the given path. This affects the filesystem */
  delete: async (path: string) => {
    buffers.remove(path)
    remove(path)
  },
  /** List all buffers with some useful metadata preloaded */
  listWithInfo: async (): Promise<BufferInfo[]> => {
    const bufs = await buffers.list()
    const currentBufferId = current.buffer.id

    const bufInfo = await Promise.all(
      bufs.map(async (b) => ({
        name: await b.name,
        current: b.id === currentBufferId,
        modified: await b.getOption(BufferOption.Modified),
        listed: await b.getOption(BufferOption.Listed),
        terminal: await b.isTerminal(),
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
  /** Add a shadow buffer used to render GUI elements on top of */
  addShadow: async (name: string) => {
    const buffer = await buffers.add(name)

    buffer.setOption(BufferOption.Type, BufferType.NonFile)
    buffer.setOption(BufferOption.Hidden, BufferHide.Hide)
    buffer.setOption(BufferOption.Listed, false)
    buffer.setOption(BufferOption.Modifiable, false)
    buffer.setOption(BufferOption.Filetype, 'veonim-shadow-buffer')

    return buffer
  },
}

const windows = {
  list: () => as.winl(req.core.listWins()),
}

const tabs = {
  list: () => as.tabl(req.core.listTabpages()),
}

const isFunc = (m: any) => is.function(m) || is.asyncfunction(m)

const getCursorPosition = () => requestFromUI.getCursorPosition()

const emptyObject: { [index: string]: any } = Object.create(null)
const g = new Proxy(emptyObject, {
  get: async (_t, name: string) => {
    const val = await req.core.getVar(name as string).catch((e) => e)
    const err =
      is.array(val) && is.string(val[1]) && /Key (.*?)not found/.test(val[1])
    return err ? undefined : val
  },
  set: (_t, name: string, val: any) => (api.core.setVar(name, val), true),
})

type RegisterAutocmd = {
  [Key in Autocmds]: (fn: (...arg: any[]) => void) => void | any
}
const autocmd: RegisterAutocmd = new Proxy(Object.create(null), {
  get: (_, event: Autocmds) => (fn: any) => watchers.autocmds.on(event, fn),
})

type BufferEvents = keyof BufferEvent
type RemoveListener = () => void
type OnEvent = {
  [Key in BufferEvents]: (
    fn: (value: BufferEvent[Key]) => void
  ) => RemoveListener
}
const on: OnEvent = new Proxy(Object.create(null), {
  get: (_, event: BufferEvents) => (fn: any) => watchers.events.on(event, fn),
})

type UntilEvent = { [Key in BufferEvents]: Promise<void> }
const untilEvent: UntilEvent = new Proxy(Object.create(null), {
  get: (_, event: BufferEvents) =>
    new Promise((done) => {
      watchers.events.once(event, done)
    }),
})

const refreshState = async () => {
  const nextState = await call.UivonimState()
  Object.assign(state, nextState)
}

// keeping this per instance of nvim, because i think it is reasonable to
// expect that the same document filepath could have different filetypes in
// different vim instances
const documentFiletypes = new Map<number, string>()
const registerFiletype = (bufnr: number, filetype: string) => {
  documentFiletypes.set(bufnr, filetype)
}

const events = [...registeredEventActions.values()].join('\\n')
cmd(`let g:uvn_cmd_completions .= "${events}\\n"`)

subscribe('uivonim', ([event, args = []]) =>
  watchers.actions.emit(event, ...args)
)
subscribe('uivonim-state', ([nextState]) => Object.assign(state, nextState))
subscribe('uivonim-position', ([position]) => Object.assign(state, position))
subscribe('uivonim-g', ([name, change = {}]) =>
  watchers.internal.emit(`gvar::${name}`, change.new)
)
subscribe('uivonim-autocmd', ([autocmd, ...arg]) => {
  // TODO: should really provide a way to scope autocmds to the current vim instance...
  if (autocmd === 'FileType') registerFiletype(arg[0], arg[1])
  watchers.autocmds.emit(autocmd, ...arg)
})

onEvent('nvim_buf_detach_event', (args: any[]) => {
  watchers.bufferEvents.emit(`detach:${args[0].id}`)
})

onEvent('nvim_buf_changedtick_event', (args: any[]) => {
  const [extContainerData, changedTick] = args
  const bufId = extContainerData.id
  watchers.bufferEvents.emit(`changedtick:${bufId}`, changedTick)
})

onEvent('nvim_buf_lines_event', (args: any[]) => {
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

refreshState()
watchers.events.emit('bufLoad')

autocmd.CompleteDone((word) => watchers.events.emit('completion', word))
autocmd.CursorMoved(() => watchers.events.emit('cursorMove'))
autocmd.CursorMovedI(() => watchers.events.emit('cursorMoveInsert'))
autocmd.BufAdd((bufId) => watchers.events.emit('bufOpen', Buffer(bufId - 0)))
autocmd.BufEnter((bufId) => watchers.events.emit('bufLoad', Buffer(bufId - 0)))
autocmd.BufWritePre((bufId) =>
  watchers.events.emit('bufWritePre', Buffer(bufId - 0))
)
autocmd.BufWritePost((bufId) =>
  watchers.events.emit('bufWrite', Buffer(bufId - 0))
)
autocmd.BufWipeout((bufId) =>
  watchers.events.emit('bufClose', Buffer(bufId - 0))
)
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
  watchers.events.emit('bufChange', current.buffer)
})

autocmd.TextChangedI((revision) => {
  state.revision = revision - 0
  watchers.events.emit('bufChangeInsert', current.buffer)
})

// TODO: i think we should just determine this from render events
autocmd.WinEnter((id: number) => watchers.events.emit('winEnter', id))

autocmd.WinEnter((id: number) => (_currentCache.window = Window(id - 0)))
as.win(req.core.getCurrentWin()).then((win) => (_currentCache.window = win))
on.bufLoad((buffer) => (_currentCache.buffer = buffer))

interface CurrentCache {
  buffer?: Buffer
  window?: Window
}

const _currentCache: CurrentCache = {
  buffer: undefined,
  window: undefined,
}

const current = {
  get buffer(): Buffer {
    const promise = as.buf(req.core.getCurrentBuf())

    return onProp<Buffer>((prop) => {
      if (prop === 'id' && _currentCache.buffer) return _currentCache.buffer.id
      const testValue = Reflect.get(dummy.buf, prop)
      if (testValue == null)
        throw new TypeError(`${prop as string} does not exist on Neovim.Buffer`)
      return isFunc(testValue)
        ? async (...args: any[]) => Reflect.get(await promise, prop)(...args)
        : promise.then((m) => Reflect.get(m, prop))
    })
  },
  get window(): Window {
    const promise = as.win(req.core.getCurrentWin())

    return onProp<Window>((prop) => {
      if (prop === 'id' && _currentCache.window) return _currentCache.window.id
      const testValue = Reflect.get(dummy.win, prop)
      if (testValue == null)
        throw new TypeError(`${prop as string} does not exist on Neovim.Window`)
      return isFunc(testValue)
        ? async (...args: any[]) => Reflect.get(await promise, prop)(...args)
        : promise.then((m) => Reflect.get(m, prop))
    })
  },
  get tabpage(): Tabpage {
    const promise = as.tab(req.core.getCurrentTabpage())

    return onProp<Tabpage>((prop) => {
      const testValue = Reflect.get(dummy.tab, prop)
      if (testValue == null)
        throw new TypeError(
          `${prop as string} does not exist on Neovim.Tabpage`
        )
      return isFunc(testValue)
        ? async (...args: any[]) => Reflect.get(await promise, prop)(...args)
        : promise.then((m) => Reflect.get(m, prop))
    })
  },
}

const fromId = {
  buffer: (id: number): Buffer => Buffer(id),
  window: (id: number): Window => Window(id),
  tabpage: (id: number): Tabpage => Tabpage(id),
}

const HL_CLR = 'nvim_buf_clear_highlight'
const HL_ADD = 'nvim_buf_add_highlight'

const Buffer = (id: any) =>
  ({
    id,
    get number() {
      return req.buf.getNumber(id)
    },
    get valid() {
      return req.buf.isValid(id)
    },
    get name() {
      return req.buf.getName(id)
    },
    get length() {
      return req.buf.lineCount(id)
    },
    get changedtick() {
      return req.buf.getChangedtick(id)
    },
    getOffset: (line) => req.buf.getOffset(id, line),
    isLoaded: () => req.buf.isLoaded(id),
    isTerminal: async () =>
      (await req.buf.getOption(id, BufferOption.Type)) === BufferType.Terminal,
    attach: ({ sendInitialBuffer }, cb) => {
      watchers.bufferEvents.on(`change:${id}`, cb)
      req.buf.attach(id, sendInitialBuffer, {}).then((attached) => {
        if (!attached) return console.error('could not attach to buffer:', id)
      })
      watchers.bufferEvents.once(`detach:${id}`, () => {
        watchers.bufferEvents.removeListener(`change:${id}`, cb)
      })
    },
    onChangedTick: (onChangedTickFn) => {
      watchers.bufferEvents.on(`changedtick:${id}`, onChangedTickFn)
      watchers.bufferEvents.once(`detach:${id}`, () => {
        watchers.bufferEvents.removeListener(
          `changedtick:${id}`,
          onChangedTickFn
        )
      })
    },
    onDetach: (onDetachFn) => {
      watchers.bufferEvents.once(`detach:${id}`, onDetachFn)
    },
    detach: () => {
      watchers.bufferEvents.removeAllListeners(`change:${id}`)
      req.buf.detach(id).then((detached) => {
        if (!detached) console.error('could not detach from buffer:', id)
      })
    },
    append: async (start, lines) => {
      const replacement = is.array(lines)
        ? (lines as string[])
        : [lines as string]
      const linesBelow = await req.buf.getLines(id, start, -2, false)
      const newLines = [...replacement, ...linesBelow]

      api.buf.setLines(
        id,
        start + 1,
        start + 1 + newLines.length,
        false,
        newLines
      )
    },
    getAllLines: () => req.buf.getLines(id, 0, -2, true),
    // getLines line ranges are end exclusive so we +1
    getLines: (start, end) => req.buf.getLines(id, start, end + 1, true),
    getLine: (start) =>
      req.buf.getLines(id, start, start + 1, true).then((m) => m[0]),
    setLines: (start, end, lines) =>
      api.buf.setLines(id, start, end, true, lines),
    delete: (start) => api.buf.setLines(id, start, start + 1, true, []),
    appendRange: async (position, text, undojoin = false) => {
      const { line, character: column } = position
      const lines = await req.buf.getLines(id, line, -2, false)
      const updatedLines = TextEditPatch.append({ lines, column, text })
      req.buf.setLines(
        id,
        line,
        line + updatedLines.length,
        false,
        updatedLines
      )
      if (undojoin) cmd('undojoin')
    },
    replaceRange: async ({ start, end }, text, undojoin = false) => {
      const lines = await req.buf.getLines(id, start.line, end.line + 1, false)
      const updatedLines = TextEditPatch.replace({
        lines,
        start: new Position(0, start.character),
        end: new Position(end.line - start.line, end.character),
        text,
      })
      req.buf.setLines(id, start.line, end.line + 1, false, updatedLines)
      if (undojoin) cmd('undojoin')
    },
    deleteRange: async ({ start, end }, undojoin = false) => {
      const lines = await req.buf.getLines(id, start.line, end.line, false)
      const updatedLines = TextEditPatch.remove({
        lines,
        start: new Position(0, start.character),
        end: new Position(end.line - start.line, end.character),
      })
      req.buf.setLines(id, start.line, end.line + 1, false, updatedLines)
      if (undojoin) cmd('undojoin')
    },
    replace: (start, line) =>
      api.buf.setLines(id, start, start + 1, false, [line]),
    getVar: (name) => req.buf.getVar(id, name),
    setVar: (name, value) => api.buf.setVar(id, name, value),
    getKeymap: (mode) => req.buf.getKeymap(id, mode),
    delVar: (name) => api.buf.delVar(id, name),
    getOption: (name) => req.buf.getOption(id, name),
    setOption: (name, value) => api.buf.setOption(id, name, value),
    setName: (name) => api.buf.setName(id, name),
    getMark: (name) => req.buf.getMark(id, name),
    addHighlight: (sourceId, hlGroup, line, colStart, colEnd) =>
      req.buf.addHighlight(id, sourceId, hlGroup, line, colStart, colEnd),
    clearHighlight: (sourceId, lineStart, lineEnd) =>
      api.buf.clearHighlight(id, sourceId, lineStart, lineEnd),
    clearAllHighlights: () => api.buf.clearHighlight(id, -1, 0, -1),
    highlightProblems: async (problems) =>
      callAtomic([
        [HL_CLR, [id, problems[0].id, 0, -1]],
        ...problems.map((p) => [
          HL_ADD,
          [id, p.id, p.group, p.line, p.columnStart, p.columnEnd],
        ]),
      ]),
    addVirtualText: (line, text) => {
      // TODO: set highlight groups in the chunks arr
      api.buf.setVirtualText(id, -1, line, [text])
    },
  } as Buffer)

const Window = (id: any) =>
  ({
    id,
    get number() {
      return req.win.getNumber(id)
    },
    get valid() {
      return req.win.isValid(id)
    },
    get tab() {
      return as.tab(req.win.getTabpage(id))
    },
    get buffer() {
      return as.buf(req.win.getBuf(id))
    },
    get cursor() {
      return req.win.getCursor(id)
    },
    get position() {
      return req.win.getPosition(id)
    },
    get height() {
      return req.win.getHeight(id)
    },
    get width() {
      return req.win.getWidth(id)
    },
    setCursor: (row, col) => api.win.setCursor(id, [row, col]),
    setHeight: (height) => api.win.setHeight(id, height),
    setWidth: (width) => api.win.setWidth(id, width),
    getVar: (name) => req.win.getVar(id, name),
    setVar: (name, val) => api.win.setVar(id, name, val),
    delVar: (name) => api.win.delVar(id, name),
    getOption: (name) => req.win.getOption(id, name),
    setOption: (name, val) => api.win.setOption(id, name, val),
  } as Window)

const Tabpage = (id: any) =>
  ({
    id,
    get number() {
      return req.tab.getNumber(id)
    },
    get valid() {
      return req.tab.isValid(id)
    },
    get window() {
      return as.win(req.tab.getWin(id))
    },
    get windows() {
      return as.winl(req.tab.listWins(id))
    },
    getVar: (name) => req.tab.getVar(id, name),
    setVar: (name, val) => api.tab.setVar(id, name, val),
    delVar: (name) => api.tab.delVar(id, name),
  } as Tabpage)

const dummy = {
  win: Window(0),
  buf: Buffer(0),
  tab: Tabpage(0),
}

const exportAPI = {
  state,
  watchState,
  onStateChange,
  onStateValue,
  untilStateValue,
  cmd,
  cmdOut,
  expr,
  call,
  feedkeys,
  normal,
  callAtomic,
  onAction,
  getCurrentLine,
  jumpTo,
  systemAction,
  current,
  g,
  on,
  untilEvent,
  buffers,
  windows,
  tabs,
  options: readonlyOptions,
  Buffer: fromId.buffer,
  Window: fromId.window,
  Tabpage: fromId.tabpage,
  getKeymap,
  getColorByName,
  getCursorPosition,
  highlightSearchPattern,
  removeHighlightSearch,
  getOptionCurrentAndFuture,
  getVarCurrentAndFuture,
}

export default exportAPI
export type NeovimAPI = typeof exportAPI
