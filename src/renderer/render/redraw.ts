import {
  addHighlight,
  generateColorLookupAtlas,
  setDefaultColors,
} from '../render/highlight-attributes'
import {
  AtlasChar,
  getChar,
  getUpdatedFontAtlasMaybe,
} from '../render/font-texture-atlas'
import * as windows from '../windows/window-manager'
import {
  hideCursor,
  showCursor,
  moveCursor,
  disableCursor,
  enableCursor,
  setCursorShape,
  setCursorColor,
} from '../cursor'
import * as dispatch from '../dispatch'
import { getColorById } from '../render/highlight-attributes'
import {
  WinFloatPosWinInfo,
  Mode,
  PopupMenu,
} from '../../common/types'
import * as workspace from '../workspace'
import { parseGuifont } from '../../common/utils'
import messages from '../components/nvim/messages'
import { showMessageHistory } from '../components/nvim/message-history'
import { forceRegenerateFontAtlas } from '../render/font-texture-atlas'
import { cell } from '../workspace'
import { invoke, listenRedraw } from '../helpers'

let dummyData = new Float32Array()

const default_colors_set = (event: any) => {
  const e = event.payload
  const count = e.length
  let defaultColorsChanged = false

  for (let ix = 0; ix < count; ix++) {
    const [fg, bg, sp] = e[ix]
    if (fg < 0 && bg < 0 && sp < 0) continue
    defaultColorsChanged = setDefaultColors(fg, bg, sp)
  }

  if (!defaultColorsChanged) return

  const colorAtlas = generateColorLookupAtlas()
  windows.webgl.updateColorAtlas(colorAtlas)
}

const hl_attr_define = ({ payload: events }: { payload: any[] }) => {
  events.forEach(({ id, attr, info }) => {
    addHighlight(id, attr, info)
  })

  const colorAtlas = generateColorLookupAtlas()
  windows.webgl.updateColorAtlas(colorAtlas)
}

const win_pos = (event: any) => {
  const wins: number[][] = event.payload;
  wins.forEach(([ gridId, winId, row, col, width, height ]) =>
    windows.set(winId, gridId, row, col, width, height)
  )
}

const win_hide = (e: any) => {
  windows.hide(e.slice(1))
}

const grid_clear = ({ payload: [[gridId]] }: { payload: number[][] }) => {
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

const grid_resize = (event: any) => {
  const e = event.payload;
  const count = e.length

  for (let ix = 0; ix < count; ix++) {
    const [gridId, width, height] = e[ix]
    if (gridId === 1) continue
    // grid events show up before win events
    if (!windows.has(gridId)) windows.set(-1, gridId, -1, -1, width, height)
    windows.get(gridId).resizeWindow(width, height)
  }
}

const grid_scroll = ({ payload: [
  [gridId, top, bottom /*left*/ /*right*/, , , amount],
]}: { payload: number[][]}) => {
  if (gridId === 1) return
  // we make the assumption that left & right will always be
  // at the window edges (left == 0 && right == window.width)
  const win = windows.get(gridId)

  amount > 0
    ? win.webgl.moveRegionUp(amount, top, bottom)
    : win.webgl.moveRegionDown(-amount, top, bottom)
}

const grid_line = (event: any) => {
  const e = event.payload
  const gridRenderIndexes: any = []
  const grids: any = []
  let hlid = 0
  let activeGrid = 0
  let buffer = dummyData
  let gridBufferSetCell = (_x: any) => {}
  let col = 0
  let prevWasDoubleWidth = false
  let prevChar: AtlasChar

  const count = e.length
  for (let ix = 0; ix < count; ix++) {
    const { grid: gridId, row, col_start: startCol, cells: charData } = e[ix]

    // TODO: anything of interest on grid 1? messages are supported by ext_messages
    if (gridId === 1) continue

    if (gridId !== activeGrid) {
      activeGrid = gridId
      const win = windows.get(gridId)
      buffer = win.webgl.getBuffer()
      gridBufferSetCell = win.webgl.setGridBufferCell
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

      const nextCD = charData[cd + 1]
      const doubleWidth =
        nextCD &&
        typeof nextCD[0] === 'string' &&
        nextCD[0].codePointAt(0) === undefined
      const atlasChar = getChar(char, doubleWidth)

      for (let r = 0; r < repeats; r++) {
        // If the previous char was double width, nvim will send an empty cell
        // "" next; we check for that, and give that info to the grid buffer so
        // webgl can handle it accordingly.
        const char = prevWasDoubleWidth
          ? {
              ...prevChar!,
              isSecondHalfOfDoubleWidthCell: true,
              bounds: {
                ...prevChar!.bounds,
                left: prevChar!.bounds.left + cell.width,
                right: prevChar!.bounds.right,
              },
            }
          : { ...atlasChar, isSecondHalfOfDoubleWidthCell: false }
        buffer[gridRenderIndexes[gridId]] = col
        buffer[gridRenderIndexes[gridId] + 1] = row
        buffer[gridRenderIndexes[gridId] + 2] = hlid
        buffer[gridRenderIndexes[gridId] + 3] = char.idx
        buffer[gridRenderIndexes[gridId] + 4] =
          char.isSecondHalfOfDoubleWidthCell ? 1 : 0
        buffer[gridRenderIndexes[gridId] + 5] = char.bounds.left
        buffer[gridRenderIndexes[gridId] + 6] = char.bounds.bottom
        gridRenderIndexes[gridId] += 7

        // TODO: could maybe deffer this to next frame?
        gridBufferSetCell({
          row,
          col,
          hlId: hlid,
          charIdx: char.idx,
          leftAtlasBounds: char.bounds.left,
          bottomAtlasBounds: char.bounds.bottom,
          isSecondHalfOfDoubleWidthCell: char.isSecondHalfOfDoubleWidthCell,
        })
        col++
      }

      prevChar = atlasChar
      prevWasDoubleWidth = doubleWidth
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
        return
      else
        invoke.nvimResizeGrid({ grid: win.gridId, cols: clampedWidth, rows: clampedHeight })

      return
    }

    const grid = windows.get(win.gridId)
    const gridInfo = grid.getWindowInfo()

    let row, col

    // Vim lines are zero-indexed, so . . . add 1 to the rows
    if (win.anchor === 'NE')
      (row = 1 + win.anchorRow), (col = win.anchorCol - gridInfo.width)
    else if (win.anchor === 'NW')
      (row = 1 + win.anchorRow), (col = win.anchorCol)
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

listenRedraw.gridLine(grid_line)
// invoke('attach_ui')
listenRedraw.gridCursorGoto(({ payload: [[gridId, row, col]]}) => {
  windows.setActiveGrid(gridId)
  moveCursor(row, col)
})
listenRedraw.gridScroll(grid_scroll)
listenRedraw.gridClear(grid_clear)
listenRedraw.gridDestroy(grid_destroy)
listenRedraw.gridResize(grid_resize)

listenRedraw.winPos(win_pos)
listenRedraw.winFloatPos(win_float_pos)
listenRedraw.winClose(win_close)
listenRedraw.winHide(win_hide)

listenRedraw.tablineUpdate(({ curtab, tabs }) =>
  requestAnimationFrame(() => dispatch.pub('tabs', { curtab, tabs }))
)
listenRedraw.modeChange(({ payload: modeInfo }) => {
  if (modeInfo.attr_id) {
    const { background } = getColorById(modeInfo.attr_id)
    if (background) setCursorColor(background)
  }

  setCursorShape(modeInfo.cursor_shape, modeInfo.cell_percentage)
})
listenRedraw.pmenuHide(() => dispatch.pub('pmenu.hide'))
listenRedraw.pmenuSelect((ix) => dispatch.pub('pmenu.select', ix))
listenRedraw.pmenuShow((data: PopupMenu) => dispatch.pub('pmenu.show', data))

listenRedraw.msgShow((message) => messages.show(message))
listenRedraw.msgStatus((status) => dispatch.pub('message.status', status))
listenRedraw.msgAppend((message) => messages.append(message))
listenRedraw.msgShowHistory((messages) => showMessageHistory(messages))
listenRedraw.msgControl((text) => dispatch.pub('message.control', text))
listenRedraw.msgClear((maybeMatcherKey) =>
  maybeMatcherKey
    ? messages.clear((message) => Reflect.get(message, maybeMatcherKey))
    : messages.clear()
)
listenRedraw.showCursor(() => showCursor())
listenRedraw.hideCursor(() => hideCursor())
listenRedraw.hideThenDisableCursor(() => (hideCursor(), disableCursor()))
listenRedraw.enableThenShowCursor(() => (enableCursor(), showCursor()))
listenRedraw.pubRedraw(() => dispatch.pub('redraw'))

listenRedraw.disposeInvalidWinsThenLayout(
  () => (windows.disposeInvalidWindows(), windows.layout())
)

listenRedraw.cmdShow(({ payload: updates }: { payload: any[] }) => {
  updates.forEach((update) => {
    if (update.prompt === '/' || update.prompt === '?') {
      dispatch.pub('search.update', update)
    } else {
      dispatch.pub('cmd.update', update)
    }   
  });
})
listenRedraw.cmdHide(() => dispatch.pub('cmd.hide'))
// listenRedraw.searchUpdate((update) => dispatch.pub('search.update', update))

listenRedraw.hlAttrDefine(hl_attr_define)
listenRedraw.defaultColorsSet(default_colors_set)

const options = new Map<string, any>()

// TODO: this parsing logic needs to be revisited
// needs to handle all nvim formatting options
const updateFont = () => {
  const lineSpace = options.get('linespace')
  const guifont = options.get('guifont')

  const { face, size } = parseGuifont(guifont)
  const changed = workspace.updateEditorFont({ face, size, lineSpace })
  if (!changed) return

  const atlas = forceRegenerateFontAtlas()
  windows.webgl.updateFontAtlas(atlas)
  windows.webgl.updateCellSize()
  workspace.resize()
  windows.resetAtlasBounds()
  windows.refreshWebGLGrid()
}

listenRedraw.optionSet(({ payload: e }) => {
  e.forEach(([k, value]: any) => options.set(k, value))

  updateFont()
})

listenRedraw.setTitle((title) => dispatch.pub('vim:title', title))

listenRedraw.wildmenuShow((items) => dispatch.pub('wildmenu.show', items))
listenRedraw.wildmenuHide(() => dispatch.pub('wildmenu.hide'))
listenRedraw.wildmenuSelect((selected) => dispatch.pub('wildmenu.select', selected))

invoke.attachUi({})