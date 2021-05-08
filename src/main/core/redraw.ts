import { MasterControl as Nvim } from './master-control'
import { RedrawEvents } from '../../common/ipc'
import { WinPosWinInfo, WinFloatPosWinInfo } from '../../common/types'

type SendFunc = (event: typeof RedrawEvents[keyof typeof RedrawEvents],
                 ...args: any[]) => void

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
enum CommandType {
  Ex,
  Prompt,
  SearchForward,
  SearchBackward,
}

interface CommandUpdate {
  cmd: string
  prompt?: string
  kind: CommandType
  position: number
}

type CmdContent = [any, string]
type CmdlineShow = [CmdContent[], number, string, string, number, number]
type CmdlineShowEvent = [any, CmdlineShow]
let currentCommandMode: CommandType
export const cmdline_show = ([ , [content, position, str1, str2, indent, level], ] : CmdlineShowEvent, 
                             send: SendFunc) => {
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

export const cmdline_hide = (send: SendFunc) => {
  Object.assign(cmdcache, { active: false, position: -999, cmd: undefined })
  send(RedrawEvents.cmdHide)
}

export const cmdline_pos = ([, [position]]: [any, [number]], send: SendFunc) => {
  if (currentCommandMode === CommandType.Ex)
    send(RedrawEvents.cmdUpdate, { position })
  else send(RedrawEvents.searchUpdate, { position })
}
// }}}

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

export const handleRedraw = (nvim: Nvim, sendToRenderer: SendFunc, redrawEvents: any[]) => {
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

    // if statements ordered in wrender priority
    
    // TODO(smolck): Really hope this doesn't need to be handled here
    if (e === 'grid_line') sendToRenderer(RedrawEvents.gridLine, ev)

    else if (e === 'flush') winUpdates = true
    else if (e === 'grid_scroll') sendToRenderer(RedrawEvents.gridScroll, ev)
    else if (e === 'grid_cursor_goto') sendToRenderer(RedrawEvents.gridCursorGoto, ev)

    else if (e === 'win_pos') (winUpdates = true), win_pos(ev, sendToRenderer)
    else if (e === 'win_float_pos') (winUpdates = true), win_float_pos(ev, sendToRenderer)
    else if (e === 'win_close') sendToRenderer(RedrawEvents.winClose, ev[1])
    else if (e === 'win_hide') sendToRenderer(RedrawEvents.winHide, ev)
    
    else if (e === 'grid_resize') (winUpdates = true), sendToRenderer(RedrawEvents.gridDestroy, ev)
    else if (e === 'grid_clear') sendToRenderer(RedrawEvents.gridClear, ev)
    else if (e === 'grid_destroy') sendToRenderer(RedrawEvents.gridDestroy, ev)
    // else if (e === 'tabline_update') tabline_update(ev)
    // else if (e === 'mode_change') renderEvents.mode_change(ev)
    // else if (e === 'popupmenu_hide') renderEvents.popupmenu_hide()
    // else if (e === 'popupmenu_select') renderEvents.popupmenu_select(ev)
    // else if (e === 'popupmenu_show') renderEvents.popupmenu_show(ev)
    else if (e === 'cmdline_show') cmdline_show(ev, sendToRenderer)
    else if (e === 'cmdline_pos') cmdline_pos(ev, sendToRenderer)
    else if (e === 'cmdline_hide') cmdline_hide(sendToRenderer)
    /*else if (e === 'hl_attr_define') hl_attr_define(ev)
    else if (e === 'default_colors_set') default_colors_set(ev)
    else if (e === 'option_set') renderEvents.option_set(ev)
    else if (e === 'mode_info_set') renderEvents.mode_info_set(ev)
    else if (e === 'wildmenu_show') renderEvents.wildmenu_show(ev)
    else if (e === 'wildmenu_select') renderEvents.wildmenu_select(ev)
    else if (e === 'wildmenu_hide') renderEvents.wildmenu_hide()
    else if (e.startsWith('msg_')) messageEvents.push(ev)
    else if (e === 'set_title') renderEvents.set_title(ev)*/
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

    if (e === 'msg_show') renderEvents.msg_show(ev, state_cursorVisible)
    else if (e === 'msg_showmode') renderEvents.msg_showmode(ev)
    else if (e === 'msg_showcmd') renderEvents.msg_showcmd(ev)
    else if (e === 'msg_history_show') renderEvents.msg_history_show(ev)
    else if (e === 'msg_clear') renderEvents.msg_clear(ev)
    else if (e === 'msg_ruler') renderEvents.msg_ruler(ev)
  }

  renderEvents.messageClearPromptsMaybeHack(state_cursorVisible)
  state_cursorVisible ? showCursor() : hideCursor()
  dispatch.pub('redraw')
  if (!winUpdates) return

  windows.disposeInvalidWindows()
  windows.layout()
}
