import CreateWindow, { Window, paddingX } from '../windows/window'
import FontAtlas from '../render/font-texture-atlas'
import Cursor from '../cursor'
import CreateWebGLRenderer from '../render/webgl/renderer'
import { onElementResize } from '../ui/vanilla'
import Workspace from '../workspace'
import { throttle } from '../utils'
import windowSizer from '../windows/sizer'
import { WindowMetadata } from '../types'
import { listen, invoke } from '../helpers'

export default class WindowManager {
  readonly size: { width: number; height: number }
  readonly workspaceRef: Workspace
  readonly renderer: ReturnType<typeof CreateWebGLRenderer>
  readonly cursor: Cursor

  private fontAtlasRef: FontAtlas

  private windowsByGrid: Map<number, Window>
  private windowsById: Map<number, Window>
  private invalidGrids: Set<number>
  private activeGrid: number
  private container: HTMLElement

  get activeGridId() {
    return this.activeGrid
  }

  setActiveGrid(gridId: number) {
    this.activeGrid = gridId
  }

  constructor(workspace: Workspace, fontAtlasRef: FontAtlas) {
    this.fontAtlasRef = fontAtlasRef
    this.workspaceRef = workspace
    this.size = { width: 0, height: 0 }
    this.renderer = CreateWebGLRenderer(
      fontAtlasRef,
      workspace,
      () => this.activeGridId
    )
    this.cursor = new Cursor(this.renderer)
    this.renderer.setCursor(this.cursor) // TODO(smolck): This is . . . yeah meh
    this.windowsByGrid = new Map()
    this.windowsById = new Map()
    this.invalidGrids = new Set()
    this.activeGrid = 0
    this.container = document.getElementById('windows')!
    const webglContainer = document.getElementById('webgl')!
    webglContainer.appendChild(this.renderer.canvasElement)

    onElementResize(webglContainer, (w, h) => {
      Object.assign(this.size, { width: w, height: h })
      this.renderer.resizeCanvas(w, h)
      for (const [_, win] of this.windowsByGrid) {
        win.refreshLayout()
        win.redrawFromGridBuffer()
      }
    })

    listen.colorschemeStateUpdated(() =>
      requestAnimationFrame(() => {
        this.renderer.clearAll()
        for (const [_, win] of this.windowsByGrid) {
          win.redrawFromGridBuffer()
        }
      })
    )

    // TODO(smolck): Even necessary anymore? Or ever was it?
    // this.renderer.canvasElement.setAttribute('wat', 'webgl-background')
    this.renderer.canvasElement.addEventListener('webglcontextlost', (e) => {
      console.log('lost webgl context, preventing default', e)
      e.preventDefault()
    })
    this.renderer.canvasElement.addEventListener(
      'webglcontextrestored',
      (_e) => {
        console.log('webgl context restored! re-initializing')
        this.renderer.reInit()
        this.refreshWebGLGrid()
      }
    )
  }

  private getWindowById(id: number) {
    const win = this.windowsById.get(id)
    if (!win) throw new Error(`trying to get window that does not exist ${id}`)
    return win
  }

  refreshWebGLGrid() {
    this.renderer.clearAll()
    this.windowsByGrid.forEach((w) => w.redrawFromGridBuffer())
  }

  calculateGlobalOffset(anchorWin: Window, float: Window) {
    if (!anchorWin.element.style.gridArea)
      throw new Error("Anchor doesn't have grid-area css")
    if (!float.element.style.top)
      throw new Error("Floating window doesn't have top positioning")
    if (!float.element.style.left)
      throw new Error("Floating window doesn't have left positioning")

    const [rowStart, colStart] = anchorWin.element.style.gridArea.split('/')

    let nTop = parseInt(rowStart, 10)
    let nLeft = parseInt(colStart, 10)

    if (nTop > 1) {
      // Move the float down so it doesn't intersect with the nameplate.
      Object.assign(float.element.style, {
        top:
          parseInt(float.element.style.top, 10) +
          this.workspaceRef.nameplateHeight +
          'px',
      })
    }

    if (nLeft > 1) {
      // Move the float over because . . . it isn't positioned right otherwise?
      // TODO(smolck): This isn't perfect . . .
      Object.assign(float.element.style, {
        left:
          parseInt(float.element.style.left, 10) +
          this.workspaceRef.pad.x +
          paddingX +
          'px',
      })
    }
  }

  createWebGLView(gridId: number) {
    return this.renderer.createView(gridId)
  }

  getActiveWindow() {
    const win = this.windowsByGrid.get(this.activeGrid)
    if (!win)
      throw new Error(
        `trying to get window that does not exist ${this.activeGrid}`
      )
    return win
  }

  addWin(
    winId: number,
    gridId: number,
    row: number,
    col: number,
    width: number,
    height: number,
    is_float: boolean = false,
    anchor = ''
  ) {
    const win =
      this.windowsByGrid.get(gridId) ||
      CreateWindow(
        this.createWebGLView(0),
        this.workspaceRef,
        this.fontAtlasRef,
        this.size
      )
    win.setWindowInfo({
      anchor,
      is_float,
      row,
      col,
      width,
      height,
      visible: true,
      id: winId,
      gridId: gridId,
    })

    if (!this.windowsByGrid.has(gridId)) this.windowsByGrid.set(gridId, win)
    if (!this.windowsById.has(winId)) this.windowsById.set(winId, win)

    // we only want to add grids that have valid window positions and do not
    // overlap coordinates with other windows. this happens rarely (in term
    // buffers) and i think it might be a nvim bug maybe...?

    // behavior 1: multiple "win_pos" events reported with the same row,col (e.g. 0,0)
    // TODO: this is broken. need to check at the redraw level
    // if (windowPosition && windowExistsAtPosition(wid, row, col)) return invalidWindows.add(gid)

    // behavior 2: receive "grid_resize" events (gridId > 1) but no followup "win_pos" events
    if (winId < 0) return this.invalidGrids.add(gridId)

    this.container.appendChild(win.element)
    this.invalidGrids.delete(gridId)

    console.log('window-manager stuff', this.windowsById, this.windowsByGrid)
  }

  // i made the assumption that a grid_resize event was always going to follow up
  // with a win_pos event. i think however there are grids that never get
  // positioned, so we need to make sure they do not get rendered
  //
  // we also win_pos events that overlap on the same start_col,start_row indexes
  // this should not happen on ext_multigrid, maybe floating windows but not here
  disposeInvalidWindows() {
    this.invalidGrids.forEach((gid) => {
      const win = this.windowsByGrid.get(gid)
      if (!win) throw new Error(`window grid does not exist ${gid}`)
      this.windowsByGrid.delete(gid)
      this.windowsById.delete(win.id)
      this.invalidGrids.delete(gid)
    })

    this.invalidGrids.delete(-1)
  }

  remove(gridId: number) {
    const win = this.windowsByGrid.get(gridId)
    if (!win)
      return console.warn(
        `trying to destroy a window that does not exist ${gridId}`
      )

    // redraw webgl first before removing DOM element
    // this helps a bit with flickering
    requestAnimationFrame(() => {
      win.element.remove()
      this.windowsById.delete(win.getWindowInfo().id)
      this.windowsByGrid.delete(gridId)
    })
  }

  getWinByGridId(gridId: number) {
    const win = this.windowsByGrid.get(gridId)
    if (!win)
      throw new Error(`trying to get window that does not exist ${gridId}`)
    return win
  }

  hasWinForGridId(gridId: number) {
    return this.windowsByGrid.has(gridId)
  }

  layout() {
    const wininfos = []
    for (const [_, win] of this.windowsByGrid) {
      wininfos.push(win.getWindowInfo())
    }
    const { gridTemplateRows, gridTemplateColumns, windowGridInfo } =
      windowSizer(this.workspaceRef.size, wininfos)

    Object.assign(this.container.style, {
      gridTemplateRows,
      gridTemplateColumns,
    })

    windowGridInfo.forEach(({ gridId, gridRow, gridColumn }) => {
      this.windowsByGrid.get(gridId)!.applyGridStyle({ gridRow, gridColumn })
    })

    // wait for flex grid styles to be applied to all windows and trigger dom layout
    windowGridInfo.forEach(({ gridId }) =>
      this.windowsByGrid.get(gridId)!.refreshLayout()
    )
    this.refreshWebGLGrid()

    // cursorline width does not always get resized correctly after window
    // layout changes, so we will force an update of the cursor to make sure
    // it is correct. test case: two vert splits, move to left and :bo
    // this.activeGrid &&
    requestAnimationFrame(() => {
      if (!this.windowsByGrid.has(this.activeGrid)) return

      // TODO(smolck): This is kinda weird
      this.cursor.moveTo(this.cursor.row, this.cursor.col)
    })
  }

  updateWindowNameplates() {
    throttle(
      () =>
        requestAnimationFrame(async () => {
          const windowsWithMetadata = await invoke.getWindowMetadata({})
          windowsWithMetadata.forEach((w: WindowMetadata) =>
            this.getWindowById(w.id).updateNameplate(w)
          )
        }),
      5
    )
  }

  hideGrids(gridIds: number[]) {
    gridIds.forEach((gridId) => this.getWinByGridId(gridId).hide())
  }

  pixelPosition(row: number, col: number) {
    const win = this.windowsByGrid.get(this.activeGrid)
    if (win) return win.positionToWorkspacePixels(row, col)
    console.warn('no active window grid... hmmm *twisty effect*')
    return { x: 0, y: 0 }
  }

  pixelPositionRelativeToCursor(rowOffset: number = 0, colOffset: number = 0) {
    return this.pixelPosition(
      this.cursor.row + rowOffset,
      this.cursor.col + colOffset
    )
  }

  resetAtlasBounds() {
    for (const [_, win] of this.windowsByGrid) {
      win.webgl.resetAtlasBounds()
    }
  }
}
