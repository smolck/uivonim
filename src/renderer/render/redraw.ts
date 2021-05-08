import {
  addHighlight,
  generateColorLookupAtlas,
  setDefaultColors,
} from '../render/highlight-attributes'
import {
  getCharIndex,
  getUpdatedFontAtlasMaybe,
} from '../render/font-texture-atlas'
import * as windows from '../windows/window-manager'
import { hideCursor, showCursor, moveCursor } from '../cursor'
import * as dispatch from '../dispatch'
import * as renderEvents from '../render/events'
import { RedrawEvents, Invokables } from '../../common/ipc'
import { WinPosWinInfo, WinFloatPosWinInfo } from '../../common/types'

let dummyData = new Float32Array()
let state_cursorVisible = true

const default_colors_set = (e: any) => {
  const count = e.length
  let defaultColorsChanged = false

  for (let ix = 1; ix < count; ix++) {
    const [fg, bg, sp] = e[ix]
    if (fg < 0 && bg < 0 && sp < 0) continue
    defaultColorsChanged = setDefaultColors(fg, bg, sp)
  }

  if (!defaultColorsChanged) return

  const colorAtlas = generateColorLookupAtlas()
  windows.webgl.updateColorAtlas(colorAtlas)
}

const hl_attr_define = (e: any) => {
  const count = e.length

  for (let ix = 1; ix < count; ix++) {
    const [id, attr /*cterm_attr*/, , info] = e[ix]
    addHighlight(id, attr, info)
  }

  const colorAtlas = generateColorLookupAtlas()
  windows.webgl.updateColorAtlas(colorAtlas)
}

const win_pos = (wins: WinPosWinInfo[]) => {
  wins.forEach(({ winId, gridId, row, col, width, height }) => 
    windows.set(winId, gridId, row, col, width, height))
}

const win_hide = (e: any) => {
  windows.hide(e.slice(1))
}

const grid_clear = ([, [gridId]]: any) => {
  if (gridId === 1) return
  if (!windows.has(gridId)) return

  const win = windows.get(gridId)
  win.webgl.clear()
  win.webgl.clearGridBuffer()
}

const grid_destroy = ([, [gridId]]: any) => {
  if (gridId === 1) return
  windows.remove(gridId)
}

const grid_resize = (e: any) => {
  const count = e.length

  for (let ix = 1; ix < count; ix++) {
    const [gridId, width, height] = e[ix]
    if (gridId === 1) continue
    // grid events show up before win events
    if (!windows.has(gridId)) windows.set(-1, gridId, -1, -1, width, height)
    windows.get(gridId).resizeWindow(width, height)
  }
}

const grid_cursor_goto = ([, [gridId, row, col]]: any) => {
  state_cursorVisible = gridId !== 1
  if (gridId === 1) return
  windows.setActiveGrid(gridId)
  moveCursor(row, col)
}

const grid_scroll = ([
  ,
  [gridId, top, bottom /*left*/ /*right*/, , , amount],
]: any) => {
  if (gridId === 1) return
  // we make the assumption that left & right will always be
  // at the window edges (left == 0 && right == window.width)
  const win = windows.get(gridId)

  amount > 0
    ? win.webgl.moveRegionUp(amount, top, bottom)
    : win.webgl.moveRegionDown(-amount, top, bottom)
}

const grid_line = (e: any) => {
  const count = e.length
  const gridRenderIndexes: any = []
  const grids: any = []
  let hlid = 0
  let activeGrid = 0
  let buffer = dummyData
  let gridBuffer = dummyData
  let width = 1
  let col = 0
  let charIndex = 0

  // first item in the event arr is the event name.
  // we skip that because it's cool to do that
  for (let ix = 1; ix < count; ix++) {
    const [gridId, row, startCol, charData] = e[ix]

    // TODO: anything of interest on grid 1? messages are supported by ext_messages
    if (gridId === 1) continue

    if (gridId !== activeGrid) {
      activeGrid = gridId
      const win = windows.get(gridId)
      width = win.cols
      buffer = win.webgl.getBuffer()
      gridBuffer = win.webgl.getGridBuffer()
      if (!gridRenderIndexes[gridId]) gridRenderIndexes[gridId] = 0
      grids.push(activeGrid)
    }

    hlid = 0
    col = startCol
    const charDataSize = charData.length

    for (let cd = 0; cd < charDataSize; cd++) {
      const data = charData[cd]
      const char = data[0]
      const repeats = data[2] || 1
      hlid = typeof data[1] === 'number' ? data[1] : hlid

      if (typeof char === 'string') {
        const nextCD = charData[cd + 1]
        const doubleWidth =
          nextCD &&
          typeof nextCD[0] === 'string' &&
          nextCD[0].codePointAt(0) === undefined
        charIndex = getCharIndex(char, doubleWidth ? 2 : 1)
      } else charIndex = char - 32

      for (let r = 0; r < repeats; r++) {
        buffer[gridRenderIndexes[gridId]] = col
        buffer[gridRenderIndexes[gridId] + 1] = row
        buffer[gridRenderIndexes[gridId] + 2] = hlid
        buffer[gridRenderIndexes[gridId] + 3] = charIndex
        gridRenderIndexes[gridId] += 4

        // TODO: could maybe deffer this to next frame?
        const bufix = col * 4 + width * row * 4
        gridBuffer[bufix] = col
        gridBuffer[bufix + 1] = row
        gridBuffer[bufix + 2] = hlid
        gridBuffer[bufix + 3] = charIndex

        col++
      }
    }
  }

  const atlas = getUpdatedFontAtlasMaybe()
  if (atlas) windows.webgl.updateFontAtlas(atlas)

  const gridCount = grids.length
  for (let ix = 0; ix < gridCount; ix++) {
    const gridId = grids[ix]
    const win = windows.get(gridId)
    const renderCount = gridRenderIndexes[gridId]
    win.webgl.render(renderCount)
  }
}

const tabline_update = ([, [curtab, tabs]]: any) => {
  requestAnimationFrame(() => dispatch.pub('tabs', { curtab, tabs }))
}

const win_close = (id: number) => {
  windows.remove(id)
}

const win_float_pos = (wins: WinFloatPosWinInfo[]) => {
  wins.forEach((win) => {
    // TODO(smolck): How to handle windows positioned outside editor window?
    // Clamp it to the editor width & height, or let it go outside the editor window
    // (as it does now)? TUI clamps it, so that's probably safest bet.

    // Handle floats not relative to editor.
    if (win.anchorGrid !== 1) {
      const gridInfo = windows.get(win.gridId).getWindowInfo()

      // Position relative to anchor window
      const anchorGrid = windows.get(win.anchorGrid)

      let row, col

      // Vim lines are zero-indexed, so . . . add 1
      let rowOffset, colOffset
      rowOffset = anchorGrid.row + 1
      colOffset = anchorGrid.col

      if (win.anchor === 'NE')
        (row = win.anchorRow + rowOffset),
          (col = win.anchorCol + colOffset - gridInfo.width)
      else if (win.anchor === 'NW')
        (row = win.anchorRow + rowOffset), (col = win.anchorCol + colOffset)
      else if (win.anchor === 'SE')
        (row = win.anchorRow + rowOffset - gridInfo.height),
          (col = win.anchorCol + colOffset - gridInfo.width)
      else if (win.anchor === 'SW')
        (row = win.anchorRow + rowOffset - gridInfo.height),
          (col = win.anchorCol + colOffset)
      else
        throw new Error(
          'Anchor was not one of the four possible values, this should not be possible.'
        )

      windows.set(
        win.winId,
        win.gridId,
        row,
        col,
        gridInfo.width,
        gridInfo.height,
        true,
        win.anchor
      )

      windows.calculateGlobalOffset(anchorGrid, windows.get(win.gridId))

      const anchorGridInfo = anchorGrid.getWindowInfo()

      const clampedWidth = Math.max(
        0,
        Math.min(gridInfo.width, anchorGridInfo.width)
      )
      const clampedHeight = Math.max(
        0,
        Math.min(gridInfo.height, anchorGridInfo.height)
      )

      if (clampedWidth === gridInfo.width && clampedHeight === gridInfo.height)
        continue
      else
        window.api.invoke(
          Invokables.nvimResizeGrid,
          win.gridId,
          clampedWidth,
          clampedHeight
        )

      continue
    }

    const grid = windows.get(win.gridId)
    const gridInfo = grid.getWindowInfo()

    let row, col

    // Vim lines are zero-indexed, so . . . add 1 to the rows
    if (win.anchor === 'NE')
      (row = 1 + win.anchorRow), (col = win.anchorCol - gridInfo.width)
    else if (win.anchor === 'NW') (row = 1 + win.anchorRow), (col = win.anchorCol)
    else if (win.anchor === 'SE')
      (row = 1 + win.anchorRow - gridInfo.height),
        (col = win.anchorCol - gridInfo.width)
    else if (win.anchor === 'SW')
      (row = 1 + win.anchorRow - gridInfo.height), (col = win.anchorCol)
    else
      throw new Error(
        'Anchor was not one of the four possible values, this should not be possible.'
      )

    windows.set(
      win.winId,
      win.gridId,
      row,
      col,
      gridInfo.width,
      gridInfo.height,
      true,
      win.anchor
    )
  })
}

// @ts-ignore
const handle: {
  [Key in keyof typeof RedrawEvents]: (fn: (...args: any[]) => void) => void
} = new Proxy(RedrawEvents, {
  get: (redrawEvents, key) => (fn: (...args: any[]) => void) => {
    window.api.onRedrawEvent(Reflect.get(redrawEvents, key), fn)
  },
})

handle.gridLine(grid_line)
handle.gridCursorGoto(grid_cursor_goto)
handle.gridScroll(grid_scroll)
handle.gridClear(grid_clear)
handle.gridDestroy(grid_destroy)
handle.gridResize(grid_resize)

handle.winPos(win_pos)
handle.winFloatPos(win_float_pos)
handle.winClose(win_close)

handle.cmdUpdate((update) => dispatch.pub('cmd.update', update))
handle.cmdHide(() => dispatch.pub('cmd.hide'))
handle.searchUpdate((update) => dispatch.pub('search.update', update))

// window.api.on(Events.nvimRedraw, (redrawEvent) => {
  /*const redrawEvents = JSON.parse(redrawEventsStringified)
  // because of circular logic/infinite loop. cmdline_show updates UI, UI makes
  // a change in the cmdline, nvim sends redraw again. we cut that stuff out
  // with coding and algorithms
  // TODO: but y tho
  if (renderEvents.doNotUpdateCmdlineIfSame(redrawEvents[0])) return
  let winUpdates = false
  const messageEvents: any = []

  const eventCount = redrawEvents.length
  for (let ix = 0; ix < eventCount; ix++) {
    const ev = redrawEvents[ix]
    const e = ev[0]

    // if statements ordered in wrender priority
    if (e === 'grid_line') grid_line(ev)
    else if (e === 'flush') winUpdates = true
    else if (e === 'grid_scroll') grid_scroll(ev)
    else if (e === 'grid_cursor_goto') grid_cursor_goto(ev)
    else if (e === 'win_pos') (winUpdates = true), win_pos(ev)
    else if (e === 'win_float_pos') (winUpdates = true), win_float_pos(ev)
    else if (e === 'win_close') win_close(ev)
    else if (e === 'win_hide') win_hide(ev)
    else if (e === 'grid_resize') (winUpdates = true), grid_resize(ev)
    else if (e === 'grid_clear') grid_clear(ev)
    else if (e === 'grid_destroy') grid_destroy(ev)
    else if (e === 'tabline_update') tabline_update(ev)
    else if (e === 'mode_change') renderEvents.mode_change(ev)
    else if (e === 'popupmenu_hide') renderEvents.popupmenu_hide()
    else if (e === 'popupmenu_select') renderEvents.popupmenu_select(ev)
    else if (e === 'popupmenu_show') renderEvents.popupmenu_show(ev)
    else if (e === 'cmdline_show') renderEvents.cmdline_show(ev)
    else if (e === 'cmdline_pos') renderEvents.cmdline_pos(ev)
    else if (e === 'cmdline_hide') renderEvents.cmdline_hide()
    else if (e === 'hl_attr_define') hl_attr_define(ev)
    else if (e === 'default_colors_set') default_colors_set(ev)
    else if (e === 'option_set') renderEvents.option_set(ev)
    else if (e === 'mode_info_set') renderEvents.mode_info_set(ev)
    else if (e === 'wildmenu_show') renderEvents.wildmenu_show(ev)
    else if (e === 'wildmenu_select') renderEvents.wildmenu_select(ev)
    else if (e === 'wildmenu_hide') renderEvents.wildmenu_hide()
    else if (e.startsWith('msg_')) messageEvents.push(ev)
    else if (e === 'set_title') renderEvents.set_title(ev)
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
  windows.layout()*/
// })
