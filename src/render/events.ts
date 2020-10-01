import { CursorShape, setCursorColor, setCursorShape } from '../core/cursor'
import { forceRegenerateFontAtlas } from '../render/font-texture-atlas'
import { showMessageHistory } from '../components/message-history'
import messages, { MessageKind } from '../components/messages'
import { getColorById } from '../render/highlight-attributes'
import { normalizeVimMode } from '../support/neovim-utils'
import * as windows from '../windows/window-manager'
import * as dispatch from '../messaging/dispatch'
import * as workspace from '../core/workspace'
import api from '../core/instance-api'

interface Mode {
  shape: CursorShape
  hlid?: number
  size?: number
}

interface ModeInfo {
  blinkoff?: number
  blinkon?: number
  blinkwait?: number
  cell_percentage?: number
  cursor_shape?: string
  attr_id?: number
  attr_id_lm?: number
  hl_id?: number
  id_lm?: number
  mouse_shape?: number
  name: string
  short_name: string
}

type CmdContent = [any, string]

interface PMenuItem {
  /** The text that will be inserted */
  word: string
  /** Single letter indicating the type of completion */
  kind: string
  /** Extra text for the popup menu, displayed after "word" or "abbr" */
  menu: string
  /** More information about the item, can be displayed in a preview window */
  info: string
}

export interface PopupMenu {
  row: number
  col: number
  grid: number
  index: number
  items: PMenuItem[]
}

interface CommandLineCache {
  cmd?: string
  active: boolean
  position: number
}

export enum CommandType {
  Ex,
  Prompt,
  SearchForward,
  SearchBackward,
}

export interface CommandUpdate {
  cmd: string
  prompt?: string
  kind: CommandType
  position: number
}

// because we skip allocating 1-char strings in msgpack decode. so if we have a 1-char
// string it might be a code point number - need to turn it back into a string. see
// msgpack-decoder for more info on how this works.
const sillyString = (s: any): string =>
  typeof s === 'number' ? String.fromCodePoint(s) : s

const modes = new Map<string, Mode>()
const options = new Map<string, any>()

const cursorShapeType = (shape?: string) => {
  if (shape === 'block') return CursorShape.block
  if (shape === 'horizontal') return CursorShape.underline
  if (shape === 'vertical') return CursorShape.line
  else return CursorShape.block
}

const messageNotifyKindMappings = new Map([
  ['echo', MessageKind.Info],
  ['emsg', MessageKind.Error],
  ['echoerr', MessageKind.Error],
  ['echomsg', MessageKind.Info],
  ['quickfix', MessageKind.System],
  // TODO: handle prompts
  ['return_prompt', MessageKind.System],
])

const showStatusMessage = (message: string) => {
  // TODO: \n on all platforms?
  const newlineCount = (message.match(/\n/g) || []).length
  if (newlineCount)
    return messages.neovim.show({ message, kind: MessageKind.Info })
  dispatch.pub('message.status', message)
}

const state = {
  messagePromptVisible: false,
  lastMessageTime: Date.now(),
}

type MessageEvent = [number, string]
export const msg_show = (
  [, [msgKind, msgs, replaceLast]]: [any, [string, MessageEvent[], boolean]],
  cursorVisible: boolean
) => {
  const lastMessageTime = state.lastMessageTime
  state.lastMessageTime = Date.now()
  const messageKind = sillyString(msgKind)
  const kind = messageNotifyKindMappings.get(messageKind)
  state.messagePromptVisible = !cursorVisible
  const message = msgs.reduce(
    (res, [, /*hlid*/ text]) => (res += sillyString(text)),
    ''
  )

  if (!kind) {
    const timeDiff = Date.now() - lastMessageTime
    const probablyNeedsToBeAppended = !replaceLast && timeDiff < 100
    if (!probablyNeedsToBeAppended) return showStatusMessage(message)
  }

  const msginfo = {
    message,
    kind: kind || MessageKind.System,
    stealsFocus: !cursorVisible,
  }

  replaceLast ? messages.neovim.show(msginfo) : messages.neovim.append(msginfo)
}

type MessageHistory = [string, [number, string][]]
export const msg_history_show = ([, [messages]]: [any, [MessageHistory[]]]) => {
  const mappedMessages = messages.map(([msgKind, msgs]) => {
    const messageKind = sillyString(msgKind)
    const kind = messageNotifyKindMappings.get(messageKind)
    const message = msgs.reduce(
      (res, [, /*hlid*/ text]) => (res += sillyString(text)),
      ''
    )
    return { message, kind: kind || MessageKind.Info }
  })
  showMessageHistory(mappedMessages)
}

export const msg_showmode = ([, [msgs]]: [any, [MessageEvent[]]]) => {
  if (!msgs.length) return dispatch.pub('message.control', '')
  msgs.forEach(([, /*hlid*/ text]) => dispatch.pub('message.control', text))
}

export const msg_showcmd = ([, [msgs]]: [any, [MessageEvent[]]]) => {
  if (!msgs.length) return dispatch.pub('message.control', '')
  msgs.forEach(([, /*hlid*/ text]) => dispatch.pub('message.control', text))
}

export const msg_clear = ([, [content]]: [any, [string]]) => {
  messages.neovim.clear()
  dispatch.pub('message.status', content)
}

// we display our own ruler based on cursor position. why use this?  i think
// maybe we could use 'set noruler' or 'set ruler' to determine if we show the
// ruler block in the statusline (with these msg_ruler events)
export const msg_ruler = (_: any) => {}

// ideally nvim would tell us when to clear message prompts like spell window and inputlist()
export const messageClearPromptsMaybeHack = (cursorVisible: boolean) => {
  if (!state.messagePromptVisible) return
  if (cursorVisible) messages.neovim.clear((m) => m.stealsFocus)
}

export const mode_change = ([, [m]]: [any, [string]]) => {
  const mode = sillyString(m)
  api.nvim.setMode(normalizeVimMode(mode))
  const info = modes.get(mode)
  if (!info) return

  if (info.hlid) {
    const { background } = getColorById(info.hlid)
    if (background) setCursorColor(background)
  }

  setCursorShape(info.shape, info.size)
}

// TODO: this parsing logic needs to be revisited
// needs to handle all nvim formatting options
const updateFont = () => {
  const lineSpace = options.get('linespace')
  const guifont = options.get('guifont')

  const [font] = guifont.match(/(?:\\,|[^,])+/g) || ['']
  const [face, ...settings] = font.split(':')
  const height = settings.find((s: string) => s.startsWith('h'))
  const size = Math.round(<any>(height || '').slice(1) - 0)

  const changed = workspace.updateEditorFont({ face, size, lineSpace })
  if (!changed) return

  const atlas = forceRegenerateFontAtlas()
  windows.webgl.updateFontAtlas(atlas)
  windows.webgl.updateCellSize()
  workspace.resize()
}

export const option_set = (e: any) => {
  e.slice(1).forEach(([k, value]: any) => options.set(sillyString(k), value))
  updateFont()
}

export const mode_info_set = ([, [, infos]]: any) =>
  infos.forEach((m: ModeInfo) => {
    const info = {
      shape: cursorShapeType(sillyString(m.cursor_shape)),
      size: m.cell_percentage,
      hlid: m.attr_id,
    }

    modes.set(m.name, info)
  })

export const set_title = ([, [title]]: [any, [string]]) =>
  dispatch.pub('vim:title', sillyString(title))

export const popupmenu_hide = () => dispatch.pub('pmenu.hide')
export const popupmenu_select = ([, [ix]]: [any, [number]]) =>
  dispatch.pub('pmenu.select', ix)
export const popupmenu_show = ([, [itemz, index, row, col, grid]]: [
  any,
  [string[], number, number, number, number]
]) => {
  const items = itemz.map((m) => {
    const [word, kind, menu, info] = m
    return { word, kind, menu, info }
  })
  const data: PopupMenu = { row, col, grid, index, items }
  dispatch.pub('pmenu.show', data)
}

export const wildmenu_show = ([, [items]]: any) =>
  dispatch.pub('wildmenu.show', items)
export const wildmenu_hide = () => dispatch.pub('wildmenu.hide')
export const wildmenu_select = ([, [selected]]: [any, [number]]) => {
  dispatch.pub('wildmenu.select', selected)
}

const cmdlineIsSame = (...args: any[]) =>
  cmdcache.active && cmdcache.position === args[1]

export const doNotUpdateCmdlineIfSame = (args: any[]) => {
  if (!args || !Array.isArray(args)) return false
  const [cmd, data] = args
  if (cmd !== 'cmdline_show') return false
  return cmdlineIsSame(...data)
}

let currentCommandMode: CommandType
const cmdcache: CommandLineCache = {
  active: false,
  position: -999,
}

type CmdlineShow = [CmdContent[], number, string, string, number, number]
export const cmdline_show = ([
  ,
  [content, position, str1, str2, indent, level],
]: [any, CmdlineShow]) => {
  const opChar = sillyString(str1)
  const prompt = sillyString(str2)
  cmdcache.active = true
  cmdcache.position = position

  // TODO: process attributes!
  const cmd = content.reduce((str, [_, item]) => str + sillyString(item), '')
  if (cmdcache.cmd === cmd) return
  cmdcache.cmd = cmd

  const kind: CommandType =
    Reflect.get(
      {
        ':': CommandType.Ex,
        '/': CommandType.SearchForward,
        '?': CommandType.SearchBackward,
      },
      opChar
    ) || CommandType.Ex

  currentCommandMode = kind

  const cmdPrompt = kind === CommandType.Ex
  const searchPrompt =
    kind === CommandType.SearchForward || kind === CommandType.SearchBackward

  if (cmdPrompt)
    dispatch.pub('cmd.update', {
      cmd,
      prompt,
      kind: prompt ? CommandType.Prompt : kind,
      position,
    } as CommandUpdate)
  else if (searchPrompt)
    dispatch.pub('search.update', {
      cmd,
      prompt,
      kind: prompt ? CommandType.Prompt : kind,
      position,
    } as CommandUpdate)

  // TODO: do the indentings thingies
  indent && console.log('indent:', indent)
  level > 1 && console.log('level:', level)
}

export const cmdline_hide = () => {
  Object.assign(cmdcache, { active: false, position: -999, cmd: undefined })
  dispatch.pub('cmd.hide')
  dispatch.pub('search.hide')
}

export const cmdline_pos = ([, [position]]: [any, [number]]) => {
  if (currentCommandMode === CommandType.Ex)
    dispatch.pub('cmd.update', { position })
  else dispatch.pub('search.update', { position })
}
