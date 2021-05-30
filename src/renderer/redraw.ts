import {
  addHighlight,
  generateColorLookupAtlas,
  setDefaultColors,
} from './highlight-attributes'
/*import {
  getCharIndex,
  getUpdatedFontAtlasMaybe,
} from '../render/font-texture-atlas'*/
import * as windows from './windows/window-manager'
import {
  hideCursor,
  showCursor,
  moveCursor,
  disableCursor,
  enableCursor,
  setCursorShape,
  setCursorColor,
} from './cursor'
import * as dispatch from './dispatch'
import { getColorById } from './highlight-attributes'
import { RedrawEvents, Invokables } from '../common/ipc'
import {
  WinPosWinInfo,
  WinFloatPosWinInfo,
  Mode,
  PopupMenu,
} from '../common/types'
import * as workspace from './workspace'
import { parseGuifont } from '../common/utils'
import messages from './components/nvim/messages'
import { showMessageHistory } from './components/nvim/message-history'
import { Scene } from './render/pkg'
// import { forceRegenerateFontAtlas } from './render/font-texture-atlas'

export default (scene: Scene) => {
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
      windows.set(winId, gridId, row, col, width, height)
    )
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
      scene.handle_grid_resize(gridId, width, height)

      // TODO(smolck): Windows will probably just be in wasm
      // grid events show up before win events
      if (!windows.has(gridId)) windows.set(-1, gridId, -1, -1, width, height)
      windows.get(gridId).resizeWindow(width, height)
    }
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
    scene.handle_grid_line(e)
    scene.maybe_regen_font_atlas()
    /*const gridCount = grids.length
    for (let ix = 0; ix < gridCount; ix++) {
      const gridId = grids[ix]
      const win = windows.get(gridId)
      const renderCount = gridRenderIndexes[gridId]
      win.webgl.render(renderCount)
    }*/
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

        if (
          clampedWidth === gridInfo.width &&
          clampedHeight === gridInfo.height
        )
          return
        else
          window.api.invoke(
            Invokables.nvimResizeGrid,
            win.gridId,
            clampedWidth,
            clampedHeight
          )

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

  // @ts-ignore
  const handle: {
    [Key in keyof typeof RedrawEvents]: (fn: (...args: any[]) => void) => void
  } = new Proxy(RedrawEvents, {
    get: (redrawEvents, key) => (fn: (...args: any[]) => void) => {
      window.api.onRedrawEvent(Reflect.get(redrawEvents, key), fn)
    },
  })

  handle.gridLine(grid_line)
  handle.gridCursorGoto((gridId, row, col) => {
    windows.setActiveGrid(gridId)
    moveCursor(row, col)
  })
  handle.gridScroll(grid_scroll)
  handle.gridClear(grid_clear)
  handle.gridDestroy(grid_destroy)
  handle.gridResize(grid_resize)

  handle.winPos(win_pos)
  handle.winFloatPos(win_float_pos)
  handle.winClose(win_close)
  handle.winHide(win_hide)

  handle.tablineUpdate(({ curtab, tabs }) =>
    requestAnimationFrame(() => dispatch.pub('tabs', { curtab, tabs }))
  )
  handle.modeChange((mode: Mode) => {
    if (mode.hlid) {
      const { background } = getColorById(mode.hlid)
      if (background) setCursorColor(background)
    }

    setCursorShape(mode.shape, mode.size)
  })
  handle.pmenuHide(() => dispatch.pub('pmenu.hide'))
  handle.pmenuSelect((ix) => dispatch.pub('pmenu.select', ix))
  handle.pmenuShow((data: PopupMenu) => dispatch.pub('pmenu.show', data))

  handle.msgShow((message) => messages.show(message))
  handle.msgStatus((status) => dispatch.pub('message.status', status))
  handle.msgAppend((message) => messages.append(message))
  handle.msgShowHistory((messages) => showMessageHistory(messages))
  handle.msgControl((text) => dispatch.pub('message.control', text))
  handle.msgClear((maybeMatcherKey) =>
    maybeMatcherKey
      ? messages.clear((message) => Reflect.get(message, maybeMatcherKey))
      : messages.clear()
  )
  handle.showCursor(() => showCursor())
  handle.hideCursor(() => hideCursor())
  handle.hideThenDisableCursor(() => (hideCursor(), disableCursor()))
  handle.enableThenShowCursor(() => (enableCursor(), showCursor()))
  handle.pubRedraw(() => dispatch.pub('redraw'))

  handle.disposeInvalidWinsThenLayout(
    () => (windows.disposeInvalidWindows(), windows.layout())
  )

  handle.cmdUpdate((update) => dispatch.pub('cmd.update', update))
  handle.cmdHide(() => dispatch.pub('cmd.hide'))
  handle.searchUpdate((update) => dispatch.pub('search.update', update))

  handle.hlAttrDefine(hl_attr_define)
  handle.defaultColorsSet(default_colors_set)

  const options = new Map<string, any>()

  // TODO: this parsing logic needs to be revisited
  // needs to handle all nvim formatting options
  const updateFont = () => {
    const lineSpace = options.get('linespace')
    const guifont = options.get('guifont')

    const { face, size } = parseGuifont(guifont)
    const changed = workspace.updateEditorFont({ face, size, lineSpace })
    if (!changed) return

    // TODO(smolck): Send the new font to wasm too and stuff.
    scene.force_regen_font_atlas()

    // const atlas = forceRegenerateFontAtlas()
    // windows.webgl.updateFontAtlas(atlas)
    windows.webgl.updateCellSize()
    workspace.resize()
  }

  handle.optionSet((e: any) => {
    e.slice(1).forEach(([k, value]: any) => options.set(k, value))

    updateFont()
  })

  handle.setTitle((title) => dispatch.pub('vim:title', title))

  handle.wildmenuShow((items) => dispatch.pub('wildmenu.show', items))
  handle.wildmenuHide(() => dispatch.pub('wildmenu.hide'))
  handle.wildmenuSelect((selected) => dispatch.pub('wildmenu.select', selected))
}