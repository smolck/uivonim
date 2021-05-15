import { MasterControl as Nvim } from './master-control'
import { RedrawEvents } from '../../common/ipc'
import {
  WinPosWinInfo,
  WinFloatPosWinInfo,
  PopupMenu,
  MessageKind,
  CommandType,
  CommandUpdate,
} from '../../common/types'
import { normalizeVimMode } from '../../common/neovim-utils'
import { BrowserWindow } from 'electron'

type SendFunc = (
  event: typeof RedrawEvents[keyof typeof RedrawEvents],
  ...args: any[]
) => void

interface CommandLineCache {
  cmd?: string
  active: boolean
  position: number
}

const cmdcache: CommandLineCache = {
  active: false,
  position: -999,
}

const doNotUpdateCmdlineIfSame = (args: any[]) => {
  const cmdlineIsSame = (...args: any[]) =>
    cmdcache.active && cmdcache.position === args[1]

  if (!args || !Array.isArray(args)) return false
  const [cmd, data] = args
  if (cmd !== 'cmdline_show') return false
  return cmdlineIsSame(...data)
}

// TODO(smolck): No longer the case, right?
// because we skip allocating 1-char strings in msgpack decode. so if we have a 1-char
// string it might be a code point number - need to turn it back into a string. see
// msgpack-decoder for more info on how this works.
// const sillyString = (s: any): string =>
// typeof s === 'number' ? String.fromCodePoint(s) : s

// {{{ Command-line
type CmdContent = [any, string]
type CmdlineShow = [CmdContent[], number, string, string, number, number]
type CmdlineShowEvent = [any, CmdlineShow]
let currentCommandMode: CommandType
const cmdline_show = (
  [, [content, position, str1, str2, indent, level]]: CmdlineShowEvent,
  send: SendFunc
) => {
  const opChar = str1
  const prompt = str2
  cmdcache.active = true
  cmdcache.position = position

  // TODO: process attributes!
  const cmd = content.reduce((str, [_, item]) => str + item, '')
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
    send(RedrawEvents.cmdUpdate, {
      cmd,
      prompt,
      kind: prompt ? CommandType.Prompt : kind,
      position,
    } as CommandUpdate)
  else if (searchPrompt)
    send(RedrawEvents.searchUpdate, {
      cmd,
      prompt,
      kind: prompt ? CommandType.Prompt : kind,
      position,
    } as CommandUpdate)

  // TODO: do the indentings thingies
  indent && console.log('indent:', indent)
  level > 1 && console.log('level:', level)
}

const cmdline_hide = (send: SendFunc) => {
  Object.assign(cmdcache, { active: false, position: -999, cmd: undefined })
  send(RedrawEvents.cmdHide)
}

const cmdline_pos = ([, [position]]: [any, [number]], send: SendFunc) => {
  if (currentCommandMode === CommandType.Ex)
    send(RedrawEvents.cmdUpdate, { position })
  else send(RedrawEvents.searchUpdate, { position })
}
// }}}

// Win-related {{{
const win_pos = (e: any, send: SendFunc) => {
  const count = e.length

  const windows: WinPosWinInfo[] = []
  for (let ix = 1; ix < count; ix++) {
    const [gridId, { data: winId }, row, col, width, height] = e[ix]
    windows.push({ gridId, winId, row, col, width, height })
  }

  send(RedrawEvents.winPos, windows)
}

const win_float_pos = (e: any, send: SendFunc) => {
  const count = e.length

  const windows: WinFloatPosWinInfo[] = []
  for (let ix = 1; ix < count; ix++) {
    const [
      gridId,
      // TODO(smolck): Is this data or id? I think it's data . . .
      { data: winId },
      anchor,
      anchorGrid,
      anchorRow,
      anchorCol,
    ] = e[ix]
    windows.push({ gridId, winId, anchor, anchorGrid, anchorRow, anchorCol })
  }

  send(RedrawEvents.winFloatPos, windows)
}
// }}}

const tabline_update = ([, [curtab, tabs]]: any, send: SendFunc) => {
  send(RedrawEvents.tablineUpdate, {
    curtab: { data: curtab.data, name: curtab.name },
    tabs: tabs.map((tab: any) => ({ data: tab.data, name: tab.name })),
  })
}

const mode_change = ([, [m]]: [any, [string]], nvim: Nvim) => {
  nvim.instanceApi.setMode(normalizeVimMode(m))
}

const popupmenu_show = (
  [, [itemz, index, row, col, grid]]: [
    any,
    [string[], number, number, number, number]
  ],
  send: SendFunc
) => {
  const items = itemz.map((m) => {
    const [word, kind, menu, info] = m
    return { word, kind, menu, info }
  })
  const data: PopupMenu = { row, col, grid, index, items }
  send(RedrawEvents.pmenuShow, data)
}

// Messages {{{
const messageNotifyKindMappings = new Map([
  ['echo', MessageKind.Info],
  ['emsg', MessageKind.Error],
  ['echoerr', MessageKind.Error],
  ['echomsg', MessageKind.Info],
  ['quickfix', MessageKind.System],
  // TODO: handle prompts
  ['return_prompt', MessageKind.System],
])

const showStatusMessage = (message: string, send: SendFunc) => {
  // TODO: \n on all platforms?
  const newlineCount = (message.match(/\n/g) || []).length
  if (newlineCount)
    return send(RedrawEvents.msgShow, { message, kind: MessageKind.Info })
  send(RedrawEvents.msgStatus, message)
}

const state = {
  messagePromptVisible: false,
  lastMessageTime: Date.now(),
}

type MessageEvent = [number, string]
const msg_show = (
  [, [messageKind, msgs, replaceLast]]: [
    any,
    [string, MessageEvent[], boolean]
  ],
  cursorVisible: boolean,
  send: SendFunc
) => {
  const lastMessageTime = state.lastMessageTime
  state.lastMessageTime = Date.now()
  const kind = messageNotifyKindMappings.get(messageKind)
  state.messagePromptVisible = !cursorVisible
  const message = msgs.reduce((res, [, /*hlid*/ text]) => (res += text), '')

  if (!kind) {
    const timeDiff = Date.now() - lastMessageTime
    const probablyNeedsToBeAppended = !replaceLast && timeDiff < 100
    if (!probablyNeedsToBeAppended) return showStatusMessage(message, send)
  }

  const msginfo = {
    message,
    kind: kind || MessageKind.System,
    stealsFocus: !cursorVisible,
  }

  replaceLast
    ? send(RedrawEvents.msgShow, msginfo)
    : send(RedrawEvents.msgAppend, msginfo)
}

type MessageHistory = [string, [number, string][]]
const msg_history_show = (
  [, [messages]]: [any, [MessageHistory[]]],
  send: SendFunc
) => {
  const mappedMessages = messages.map(([messageKind, msgs]) => {
    const kind = messageNotifyKindMappings.get(messageKind)
    const message = msgs.reduce((res, [, /*hlid*/ text]) => (res += text), '')
    return { message, kind: kind || MessageKind.Info }
  })

  send(RedrawEvents.msgShowHistory, mappedMessages)
}

const msg_showmode = ([, [msgs]]: [any, [MessageEvent[]]], send: SendFunc) => {
  if (!msgs.length) return send(RedrawEvents.msgControl, '')
  msgs.forEach(([, /*hlid*/ text]) => send(RedrawEvents.msgControl, text))
}

const msg_showcmd = ([, [msgs]]: [any, [MessageEvent[]]], send: SendFunc) => {
  if (!msgs.length) return send(RedrawEvents.msgControl, '')
  msgs.forEach(([, /*hlid*/ text]) => send(RedrawEvents.msgControl, text))
}

const msg_clear = ([, [content]]: [any, [string]], send: SendFunc) => {
  send(RedrawEvents.msgClear)
  send(RedrawEvents.msgStatus, content)
}

// we display our own ruler based on cursor position. why use this?  i think
// maybe we could use 'set noruler' or 'set ruler' to determine if we show the
// ruler block in the statusline (with these msg_ruler events)
const msg_ruler = (_: any) => {}

// ideally nvim would tell us when to clear message prompts like spell window and inputlist()
const messageClearPromptsMaybeHack = (
  cursorVisible: boolean,
  send: SendFunc
) => {
  if (!state.messagePromptVisible) return
  if (cursorVisible) send(RedrawEvents.msgClear, 'stealsFocus')
}
// }}}

const grid_cursor_goto = ([, [gridId, row, col]]: any, send: SendFunc) => {
  state_cursorVisible = gridId !== 1
  if (gridId === 1) return
  send(RedrawEvents.gridCursorGoto, gridId, row, col)
}

let state_cursorVisible = true
export const handleRedraw = (
  nvim: Nvim,
  win: BrowserWindow,
  redrawEvents: any[]
) => {
  const sendToRenderer = (
    channel: typeof RedrawEvents[keyof typeof RedrawEvents],
    ...args: any[]
  ) => win.webContents.send(channel, ...args)
  // because of circular logic/infinite loop. cmdline_show updates UI, UI makes
  // a change in the cmdline, nvim sends redraw again. we cut that stuff out
  // with coding and algorithms
  // TODO: but y tho
  if (doNotUpdateCmdlineIfSame(redrawEvents[0])) return
  let winUpdates = false
  const messageEvents: any = []

  const eventCount = redrawEvents.length
  for (let ix = 0; ix < eventCount; ix++) {
    const ev = redrawEvents[ix]
    const e = ev[0]

    // TODO(smolck): Is this still the case? "if statements ordered in wrender priority"
    // Done a lot here since then perhaps . . .
    if (e === 'grid_line') sendToRenderer(RedrawEvents.gridLine, ev)
    // TODO(smolck): Really hope this doesn't need to be handled here
    else if (e === 'flush') (winUpdates = true, sendToRenderer(RedrawEvents.flush))
    else if (e === 'grid_scroll') sendToRenderer(RedrawEvents.gridScroll, ev)
    else if (e === 'grid_cursor_goto') grid_cursor_goto(ev, sendToRenderer)
    else if (e === 'win_pos') (winUpdates = true), win_pos(ev, sendToRenderer)
    else if (e === 'win_float_pos')
      (winUpdates = true), win_float_pos(ev, sendToRenderer)
    else if (e === 'win_close') sendToRenderer(RedrawEvents.winClose, ev[1])
    else if (e === 'win_hide') sendToRenderer(RedrawEvents.winHide, ev)
    else if (e === 'grid_resize')
      (winUpdates = true), sendToRenderer(RedrawEvents.gridResize, ev)
    else if (e === 'grid_clear') sendToRenderer(RedrawEvents.gridClear, ev)
    else if (e === 'grid_destroy') sendToRenderer(RedrawEvents.gridDestroy, ev)
    else if (e === 'tabline_update') tabline_update(ev, sendToRenderer)
    // TODO(smolck): call mode_change and send to renderer?
    else if (e === 'mode_change') (mode_change(ev, nvim), sendToRenderer(RedrawEvents.modeChange, ev))
    else if (e === 'popupmenu_hide') sendToRenderer(RedrawEvents.pmenuHide)
    else if (e === 'popupmenu_select')
      sendToRenderer(RedrawEvents.pmenuSelect, ev[1][0])
    else if (e === 'popupmenu_show') popupmenu_show(ev, sendToRenderer)
    else if (e === 'cmdline_show') cmdline_show(ev, sendToRenderer)
    else if (e === 'cmdline_pos') cmdline_pos(ev, sendToRenderer)
    else if (e === 'cmdline_hide') cmdline_hide(sendToRenderer)
    else if (e === 'hl_attr_define')
      sendToRenderer(RedrawEvents.hlAttrDefine, ev)
    else if (e === 'default_colors_set')
      sendToRenderer(RedrawEvents.defaultColorsSet, ev)
    else if (e === 'option_set') sendToRenderer(RedrawEvents.optionSet, ev)
    else if (e === 'mode_info_set') sendToRenderer(RedrawEvents.modeInfoSet, ev)
    else if (e === 'wildmenu_show')
      sendToRenderer(RedrawEvents.wildmenuShow, ev[1][0])
    else if (e === 'wildmenu_select')
      sendToRenderer(RedrawEvents.wildmenuSelect, ev[1][0])
    else if (e === 'wildmenu_hide') sendToRenderer(RedrawEvents.wildmenuHide)
    else if (e.startsWith('msg_')) messageEvents.push(ev)
    else if (e === 'set_title') sendToRenderer(RedrawEvents.setTitle, ev[1][0])
    else if (e === 'busy_start') sendToRenderer(RedrawEvents.busyStart)
    else if (e === 'busy_stop') sendToRenderer(RedrawEvents.busyStop)
  }

  // we queue the message events because we are interested to know
  // if the cursor is visible or not when the message will be displayed.
  // this is kind of a hack - we do this because certain messages will
  // steal input (like spell window/inputlist()) and we want the message
  // UI to indicate that focus has been changed. ideally nvim would
  // send some sort of message kind ("return_prompt" maybe?)
  const messageEventsCount = messageEvents.length
  for (let ix = 0; ix < messageEventsCount; ix++) {
    const ev = messageEvents[ix]
    const e = ev[0]

    if (e === 'msg_show') msg_show(ev, state_cursorVisible, sendToRenderer)
    else if (e === 'msg_showmode') msg_showmode(ev, sendToRenderer)
    else if (e === 'msg_showcmd') msg_showcmd(ev, sendToRenderer)
    else if (e === 'msg_history_show') msg_history_show(ev, sendToRenderer)
    else if (e === 'msg_clear') msg_clear(ev, sendToRenderer)
    else if (e === 'msg_ruler') msg_ruler(ev)
  }

  messageClearPromptsMaybeHack(state_cursorVisible, sendToRenderer)
  state_cursorVisible
    ? sendToRenderer(RedrawEvents.showCursor)
    : sendToRenderer(RedrawEvents.hideCursor)
  sendToRenderer(RedrawEvents.pubRedraw)
  if (!winUpdates) return

  sendToRenderer(RedrawEvents.disposeInvalidWinsThenLayout)
}
