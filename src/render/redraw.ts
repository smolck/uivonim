import Workspace from '../workspace'
import FontAtlas, { AtlasChar } from '../render/font-texture-atlas'
import WindowManager from '../windows/window-manager'
import {
  addHighlight,
  generateColorLookupAtlas,
  setDefaultColors,
} from '../render/highlight-attributes'
import * as dispatch from '../dispatch'
import { getColorById } from '../render/highlight-attributes'
import { WinFloatPosWinInfo, Mode, PopupMenu } from '../types'
import { parseGuifont } from '../utils'
import messages from '../components/nvim/messages'
import messageHistoryCreateThingy from '../components/nvim/message-history'
import { invoke, listenRedraw, listen } from '../helpers'

const dummyData = new Float32Array()

export default class RedrawHandler {
  private windowManagerRef: WindowManager
  private workspaceRef: Workspace
  private messageHistory: ReturnType<typeof messageHistoryCreateThingy>
  private fontAtlasRef: FontAtlas

  constructor(
    windowManager: WindowManager,
    fontAtlas: FontAtlas,
    workspace: Workspace
  ) {
    this.windowManagerRef = windowManager
    this.workspaceRef = workspace
    this.fontAtlasRef = fontAtlas
    this.messageHistory = messageHistoryCreateThingy(
      this.windowManagerRef.cursor
    )
  }

  setupHandlers() {
    listen.nvimShowMessage((msg) => messages.show(msg)) // TODO(smolck)

    const h = this.handlers
    listenRedraw.gridLine(h.grid_line)
    // invoke('attach_ui')
    listenRedraw.gridCursorGoto(({ payload: [[gridId, row, col]] }) => {
      this.windowManagerRef.setActiveGrid(gridId)
      this.windowManagerRef.cursor.moveTo(row, col)
    })
    listenRedraw.gridScroll(h.grid_scroll)
    listenRedraw.gridClear(h.grid_clear)
    listenRedraw.gridDestroy(h.grid_destroy)
    listenRedraw.gridResize(h.grid_resize)

    listenRedraw.winPos(h.win_pos)
    listenRedraw.winFloatPos(h.win_float_pos)
    listenRedraw.winClose(h.win_close)
    listenRedraw.winHide(({ payload }) => h.win_hide(payload))

    listenRedraw.tablineUpdate(({ payload: [{ curtab, tabs }] }) =>
      requestAnimationFrame(() => dispatch.pub('tabs', { curtab, tabs }))
    )
    listenRedraw.modeChange(({ payload: modeInfo }) => {
      if (modeInfo.attr_id) {
        const { background } = getColorById(modeInfo.attr_id)
        if (background) this.windowManagerRef.cursor.setColor(background)
      }

      this.windowManagerRef.cursor.setShape(
        modeInfo.cursor_shape,
        modeInfo.cell_percentage
      )
    })
    listenRedraw.pmenuHide(() => {
      dispatch.pub('pmenu.hide')
      // Seems weird, but the popupmenu_hide event handles hiding the wildmenu too .
      // . . not really sure why that's the nvim API now, the deprecated
      // ext_wildmenu seems maybe better but . . . that's the state of things.
      dispatch.pub('wildmenu.hide')
    })
    listenRedraw.pmenuSelect(({ payload: ix }) => {
      dispatch.pub('pmenu.select', ix)
      // See note above for pmenuHide handler ^^^
      dispatch.pub('wildmenu.select', ix)
    })

    listenRedraw.wildmenuShow(({ payload: items }) =>
      dispatch.pub('wildmenu.show', items)
    )
    // TODO(smolck): This and other events assume only one will be sent
    // per batch, which may or may not be a safe assumption?? Not sure . . .
    listenRedraw.pmenuShow(({ payload: data }: { payload: PopupMenu }) =>
      dispatch.pub('pmenu.show', data)
    )

    listenRedraw.msgShow(({ payload: message }) => messages.show(message))
    listenRedraw.msgStatus(({ payload: status }) =>
      dispatch.pub('message.status', status)
    )
    listenRedraw.msgAppend(({ payload: message }) => messages.append(message))
    listenRedraw.msgHistoryShow(({ payload: messages }) =>
      this.messageHistory(messages)
    )
    listenRedraw.msgControl(({ payload: text }) =>
      dispatch.pub('message.control', text)
    )
    listenRedraw.msgClear((_) => messages.clear())
    listenRedraw.showCursor(() => this.windowManagerRef.cursor.show())
    listenRedraw.hideCursor(() => this.windowManagerRef.cursor.hide())
    listenRedraw.hideThenDisableCursor(
      () => (
        this.windowManagerRef.cursor.hide(),
        this.windowManagerRef.cursor.disable()
      )
    )
    listenRedraw.enableThenShowCursor(
      () => (
        this.windowManagerRef.cursor.enable(),
        this.windowManagerRef.cursor.show()
      )
    )
    listenRedraw.pubRedraw(() => dispatch.pub('redraw'))

    listenRedraw.disposeInvalidWinsThenLayout(
      () => (
        this.windowManagerRef.disposeInvalidWindows(),
        this.windowManagerRef.layout()
      )
    )

    let currentCommandMode = 'cmd'
    listenRedraw.cmdShow(({ payload: updates }: { payload: any[] }) => {
      updates.forEach((update) => {
        if (update.firstc === '/' || update.firstc === '?') {
          currentCommandMode = 'search'
          dispatch.pub('search.update', update)
        } else {
          currentCommandMode = 'cmd'
          dispatch.pub('cmd.update', update)
        }
      })
    })
    listenRedraw.cmdHide(() =>
      dispatch.pub(currentCommandMode === 'cmd' ? 'cmd.hide' : 'search.hide')
    )
    listenRedraw.cmdPos(({ payload: [pos, _level] }) =>
      dispatch.pub(
        currentCommandMode === 'cmd' ? 'cmd.update' : 'search.update',
        {
          position: pos,
        }
      )
    )

    listenRedraw.hlAttrDefine(h.hl_attr_define)
    listenRedraw.defaultColorsSet(h.default_colors_set)

    const options = new Map<string, any>()

    // TODO: this parsing logic needs to be revisited
    // needs to handle all nvim formatting options
    const updateFont = () => {
      const lineSpace = options.get('linespace')
      const guifont = options.get('guifont')

      const { face, size } = parseGuifont(guifont)
      const changed = this.workspaceRef.updateEditorFont({
        face,
        size,
        lineSpace,
      })
      if (!changed) return

      const atlas = this.fontAtlasRef.forceRegenerateFontAtlas()
      this.windowManagerRef.renderer.updateFontAtlas(atlas)
      this.windowManagerRef.renderer.updateCellSize()
      this.workspaceRef.resize()
      this.windowManagerRef.resetAtlasBounds()
      this.windowManagerRef.refreshWebGLGrid()
    }

    listenRedraw.optionSet(({ payload: e }) => {
      e.forEach(([k, value]: any) => options.set(k, value))

      updateFont()
    })

    listenRedraw.setTitle((title) => dispatch.pub('vim:title', title))
  }

  handlers = {
    default_colors_set: ({ payload: e }: { payload: any }) => {
      const count = e.length
      let defaultColorsChanged = false

      for (let ix = 0; ix < count; ix++) {
        const [fg, bg, sp] = e[ix]
        if (fg < 0 && bg < 0 && sp < 0) continue
        defaultColorsChanged = setDefaultColors(fg, bg, sp)
      }

      if (!defaultColorsChanged) return

      const colorAtlas = generateColorLookupAtlas()
      this.windowManagerRef.renderer.updateColorAtlas(colorAtlas)
    },
    hl_attr_define: ({ payload: events }: { payload: any[] }) => {
      events.forEach(({ id, attr, info }) => {
        addHighlight(id, attr, info)
      })

      const colorAtlas = generateColorLookupAtlas()
      this.windowManagerRef.renderer.updateColorAtlas(colorAtlas)
    },
    win_pos: (event: any) => {
      const wins: number[][] = event.payload
      wins.forEach(([gridId, winId, row, col, width, height]) =>
        this.windowManagerRef.addWin(winId, gridId, row, col, width, height)
      )
    },

    win_hide: (e: number[]) => {
      this.windowManagerRef.hideGrids(e)
    },

    grid_clear: ({ payload: [[gridId]] }: { payload: number[][] }) => {
      if (gridId === 1) return
      if (!this.windowManagerRef.hasWinForGridId(gridId)) return

      const win = this.windowManagerRef.getWinByGridId(gridId)
      win.webgl.clear()
      win.webgl.clearGridBuffer()
    },

    grid_destroy: ({ payload: [gridId] }: { payload: number[] }) => {
      if (gridId === 1) return
      this.windowManagerRef.remove(gridId)
    },

    grid_resize: (event: any) => {
      const e = event.payload
      const count = e.length

      for (let ix = 0; ix < count; ix++) {
        const [gridId, width, height] = e[ix]
        if (gridId === 1) continue
        // grid events show up before win events
        if (!this.windowManagerRef.hasWinForGridId(gridId))
          this.windowManagerRef.addWin(-1, gridId, -1, -1, width, height)
        this.windowManagerRef.getWinByGridId(gridId).resizeWindow(width, height)
      }
    },

    grid_scroll: ({
      payload: [[gridId, top, bottom /*left*/ /*right*/, , , amount]],
    }: {
      payload: number[][]
    }) => {
      if (gridId === 1) return
      // we make the assumption that left & right will always be
      // at the window edges (left == 0 && right == window.width)
      const win = this.windowManagerRef.getWinByGridId(gridId)

      amount > 0
        ? win.webgl.moveRegionUp(amount, top, bottom)
        : win.webgl.moveRegionDown(-amount, top, bottom)
    },

    grid_line: (event: any) => {
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
        const {
          grid: gridId,
          row,
          col_start: startCol,
          cells: charData,
        } = e[ix]

        // TODO: anything of interest on grid 1? messages are supported by ext_messages
        if (gridId === 1) continue

        if (gridId !== activeGrid) {
          activeGrid = gridId
          const win = this.windowManagerRef.getWinByGridId(gridId)
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
          const atlasChar = this.fontAtlasRef.getChar(char, doubleWidth)

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
                    left: prevChar!.bounds.left + this.workspaceRef.cell.width,
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

      const atlas = this.fontAtlasRef.getUpdatedFontAtlasMaybe()
      if (atlas) this.windowManagerRef.renderer.updateFontAtlas(atlas)

      const gridCount = grids.length
      for (let ix = 0; ix < gridCount; ix++) {
        const gridId = grids[ix]
        const win = this.windowManagerRef.getWinByGridId(gridId)
        const renderCount = gridRenderIndexes[gridId]
        win.webgl.render(renderCount)
      }
    },

    win_close: ({ payload: [id] }: { payload: number[] }) => {
      this.windowManagerRef.remove(id)
    },

    win_float_pos: ({ payload: wins }: { payload: WinFloatPosWinInfo[] }) => {
      wins.forEach((win) => {
        // TODO(smolck): How to handle windows positioned outside editor window?
        // Clamp it to the editor width & height, or let it go outside the editor window
        // (as it does now)? TUI clamps it, so that's probably safest bet.

        // Handle floats not relative to editor.
        if (win.anchorGrid !== 1) {
          const gridInfo = this.windowManagerRef
            .getWinByGridId(win.gridId)
            .getWindowInfo()

          // Position relative to anchor window
          const anchorGrid = this.windowManagerRef.getWinByGridId(
            win.anchorGrid
          )

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

          this.windowManagerRef.addWin(
            win.winId,
            win.gridId,
            row,
            col,
            gridInfo.width,
            gridInfo.height,
            true,
            win.anchor
          )

          this.windowManagerRef.calculateGlobalOffset(
            anchorGrid,
            this.windowManagerRef.getWinByGridId(win.gridId)
          )

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
            invoke.nvimResizeGrid({
              grid: win.gridId,
              cols: clampedWidth,
              rows: clampedHeight,
            })

          return
        }

        const grid = this.windowManagerRef.getWinByGridId(win.gridId)
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

        this.windowManagerRef.addWin(
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
    },
  }
}
