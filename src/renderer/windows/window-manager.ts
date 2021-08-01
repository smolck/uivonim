import CreateWindow, { Window, paddingX } from '../windows/window'
import { cursor, moveCursor } from '../cursor'
import CreateWebGLRenderer from '../render/webgl/renderer'
import { onElementResize } from '../ui/vanilla'
import * as workspace from '../workspace'
import { throttle } from '../../common/utils'
import windowSizer from '../windows/sizer'
import { Events } from '../../common/ipc'
import { listen } from '@tauri-apps/api/event'

export const size = { width: 0, height: 0 }
export const webgl = CreateWebGLRenderer()
const windowsByGrid = new Map<number, Window>()
const windowsById = new Map<number, Window>()
const invalidGrids = new Set<number>()
let activeGrid = 0
const container = document.getElementById('windows') as HTMLElement
const webglContainer = document.getElementById('webgl') as HTMLElement

const getWindowById = (windowId: number) => {
  const win = windowsById.get(windowId)
  if (!win)
    throw new Error(
      `trying to get window that does not exist ${windowId}`
    )
  return win
}

// TODO(smolck): Any reason not to export this?
export const refreshWebGLGrid = () => {
  webgl.clearAll()
  windowsByGrid.forEach((w) => w.redrawFromGridBuffer())
}

webgl.canvasElement.addEventListener('webglcontextlost', (e) => {
  console.log('lost webgl context, preventing default', e)
  e.preventDefault()
})
webgl.canvasElement.addEventListener('webglcontextrestored', (_e) => {
  console.log('webgl context restored! re-initializing')
  webgl.reInit()
  refreshWebGLGrid()
})

export const calculateGlobalOffset = (anchorWin: Window, float: Window) => {
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
        workspace.size.nameplateHeight +
        'px',
    })
  }

  if (nLeft > 1) {
    // Move the float over because . . . it isn't positioned right otherwise?
    // TODO(smolck): This isn't perfect . . .
    Object.assign(float.element.style, {
      left:
        parseInt(float.element.style.left, 10) +
        workspace.pad.x +
        paddingX +
        'px',
    })
  }
}

export const createWebGLView = (gridId: number) => webgl.createView(gridId)

export const getActiveGridId = () => activeGrid

export const setActiveGrid = (id: number) =>
  activeGrid = id

export const getActive = () => {
  const win = windowsByGrid.get(activeGrid)
  if (!win)
    throw new Error(
      `trying to get window that does not exist ${activeGrid}`
    )
  return win
}

export const set = (
  winId: number,
  gridId: number,
  row: number,
  col: number,
  width: number,
  height: number,
  is_float: boolean = false,
  anchor = ''
) => {
  const win = windowsByGrid.get(gridId) || CreateWindow()
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

  if (!windowsByGrid.has(gridId)) windowsByGrid.set(gridId, win)
  if (!windowsById.has(winId)) windowsById.set(winId, win)

  // we only want to add grids that have valid window positions and do not
  // overlap coordinates with other windows. this happens rarely (in term
  // buffers) and i think it might be a nvim bug maybe...?

  // behavior 1: multiple "win_pos" events reported with the same row,col (e.g. 0,0)
  // TODO: this is broken. need to check at the redraw level
  // if (windowPosition && windowExistsAtPosition(wid, row, col)) return invalidWindows.add(gid)

  // behavior 2: receive "grid_resize" events (gridId > 1) but no followup "win_pos" events
  if (winId < 0) return invalidGrids.add(gridId)

  container.appendChild(win.element)
  invalidGrids.delete(gridId)

  console.log("window-manager stuff", windowsById, windowsByGrid)
}

// i made the assumption that a grid_resize event was always going to follow up
// with a win_pos event. i think however there are grids that never get
// positioned, so we need to make sure they do not get rendered
//
// we also win_pos events that overlap on the same start_col,start_row indexes
// this should not happen on ext_multigrid, maybe floating windows but not here
export const disposeInvalidWindows = () => {
  invalidGrids.forEach((gid) => {
    const win = windowsByGrid.get(gid)
    if (!win) throw new Error(`window grid does not exist ${gid}`)
    windowsByGrid.delete(gid)
    windowsById.delete(win.id)
    invalidGrids.delete(gid)
  })

  invalidGrids.delete(-1)
}

export const remove = (gridId: number) => {
  const win = windowsByGrid.get(gridId)
  if (!win)
    return console.warn(
      `trying to destroy a window that does not exist ${gridId}`
    )

  // redraw webgl first before removing DOM element
  // this helps a bit with flickering
  requestAnimationFrame(() => {
    win.element.remove()
    windowsById.delete(win.getWindowInfo().id)
    windowsByGrid.delete(gridId)
  })
}

export const get = (gridId: number) => {
  const win = windowsByGrid.get(gridId)
  if (!win)
    throw new Error(
      `trying to get window that does not exist ${gridId}`
    )
  return win
}

export const has = (gridId: number) => windowsByGrid.has(gridId)

export const layout = () => {
  const wininfos = []
  for (const [_, win] of windowsByGrid) {
    wininfos.push(win.getWindowInfo())
  }
  const { gridTemplateRows, gridTemplateColumns, windowGridInfo } =
    windowSizer(wininfos)

  Object.assign(container.style, { gridTemplateRows, gridTemplateColumns })

  windowGridInfo.forEach(({ gridId, gridRow, gridColumn }) => {
    windowsByGrid.get(gridId)!.applyGridStyle({ gridRow, gridColumn })
  })

  // wait for flex grid styles to be applied to all windows and trigger dom layout
  windowGridInfo.forEach(({ gridId }) => windowsByGrid.get(gridId)!.refreshLayout())
  refreshWebGLGrid()

  // cursorline width does not always get resized correctly after window
  // layout changes, so we will force an update of the cursor to make sure
  // it is correct. test case: two vert splits, move to left and :bo
  activeGrid &&
    requestAnimationFrame(() => {
      if (!windowsByGrid.has(activeGrid)) return
      moveCursor(cursor.row, cursor.col)
    })
}

const updateWindowNameplates = () =>
  requestAnimationFrame(async () => {
    const windowsWithMetadata = await window.api.getWindowMetadata()
    windowsWithMetadata.forEach((w) => getWindowById(w.id).updateNameplate(w))
  })

export const refresh = throttle(updateWindowNameplates, 5)

export const hide = (gridIds: number[][]) =>
  gridIds.forEach(([gridId]) => get(gridId).hide())

export const pixelPosition = (row: number, col: number) => {
  const win = windowsByGrid.get(activeGrid)
  if (win) return win.positionToWorkspacePixels(row, col)
  console.warn('no active window grid... hmmm *twisty effect*')
  return { x: 0, y: 0 }
}

webgl.canvasElement.setAttribute('wat', 'webgl-background')

Object.assign(webglContainer.style, {
  position: 'absolute',
  width: '100%',
  height: '100%',
  flex: 1,
  zIndex: 2,
  background: 'var(--background)',
})

Object.assign(container.style, {
  position: 'absolute',
  width: '100%',
  height: '100%',
  flex: 1,
  zIndex: 5,
  display: 'grid',
  justifyItems: 'stretch',
  alignItems: 'stretch',
  background: 'none',
})

webglContainer.appendChild(webgl.canvasElement)

onElementResize(webglContainer, (w, h) => {
  Object.assign(size, { width: w, height: h })
  webgl.resizeCanvas(w, h)
  for (const [_, win] of windowsByGrid) {
    win.refreshLayout()
    win.redrawFromGridBuffer()
  }
})

listen(Events.colorschemeStateUpdated, () =>
  requestAnimationFrame(() => {
    webgl.clearAll()
    for (const [_, win] of windowsByGrid) {
      win.redrawFromGridBuffer()
    }
  })
)

export const resetAtlasBounds = () => {
  for (const [_, win] of windowsByGrid) {
    win.webgl.resetAtlasBounds()
  }
}
