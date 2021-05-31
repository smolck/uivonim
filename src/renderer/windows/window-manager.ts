import CreateWindow, { Window, paddingX } from '../windows/window'
import { cursor, moveCursor } from '../cursor'
import { onElementResize } from '../ui/vanilla'
import * as workspace from '../workspace'
import { throttle } from '../../common/utils'
import windowSizer from '../windows/sizer'
import { Events } from '../../common/ipc'
import { Scene } from '../render/pkg'
type Wasm = typeof import('../render/pkg')

let scene: Scene | undefined
let dontUseThisHtmlCanvas: HTMLCanvasElement | undefined
const webglCanvasElement = () => {
  if (!dontUseThisHtmlCanvas) throw new Error("window-manager: need to setup the scene!!!!")

  return dontUseThisHtmlCanvas
}

const setupCanvas = () => {
  const canvas = webglCanvasElement()
  webglContainer.appendChild(canvas)
  canvas.addEventListener('webglcontextlost', (e: any) => {
    console.log('lost webgl foreground context, preventing default', e)
    e.preventDefault()
  })
  canvas.addEventListener('webglcontextrestored', async (_e: any) => {
    console.log('webgl foreground context restored! re-initializing')
    // TODO(smolck): I think this is equivalent to what we had before? webgl.reInit({ bg: false, fg: true })
    await setupScene()
    refreshWebGLGrid()
  })
  canvas.setAttribute('wat', 'webgl')
  Object.assign(canvas.style, {
    position: 'absolute',
    zIndex: 3,
  })
}

let wasm: Wasm
export const setupScene = async () => {
  console.log("bruh its set up")
  wasm = await import('../render/pkg')

  dontUseThisHtmlCanvas = document.createElement('canvas')
  setupCanvas()
  scene = wasm.Scene.new(dontUseThisHtmlCanvas)
}

export const size = { width: 0, height: 0 }
const windows = new Map<number, Window>()
const windowsById = new Map<number, Window>()

const invalidWindows = new Set<number>()
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

const getInstanceWindows = () => [...windows.values()]

const refreshWebGLGrid = () => {
  // scene().clear_all()
  getInstanceWindows().forEach((w) => w.redraw())
}

// TODO(smolck)
/*webgl.backgroundElement.addEventListener('webglcontextlost', (e: any) => {
  console.log('lost webgl background context, preventing default', e)
  e.preventDefault()
})
webgl.backgroundElement.addEventListener('webglcontextrestored', (_e: any) => {
  console.log('webgl foreground context restored! re-initializing')
  webgl.reInit({ bg: true, fg: false })
  refreshWebGLGrid()
})*/

const updateWindowNameplates = () =>
  requestAnimationFrame(async () => {
    const windowsWithMetadata = await window.api.getWindowMetadata()
    windowsWithMetadata.forEach((w) => getWindowById(w.id).updateNameplate(w))
  })

// TODO(smolck)
// webgl.backgroundElement.setAttribute('wat', 'webgl-background')
// webgl.foregroundElement.setAttribute('wat', 'webgl-foreground')

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

/*Object.assign(webgl.backgroundElement.style, {
  position: 'absolute',
  zIndex: 3,
})

Object.assign(webgl.foregroundElement.style, {
  position: 'absolute',
  zIndex: 4,
})*/

// webglContainer.appendChild(webgl.backgroundElement)
// webglContainer.appendChild(webgl.foregroundElement)

const resizeCanvas = (width: number, height: number) => {
  const canvas = webglCanvasElement()
    const w = Math.round(width * window.devicePixelRatio)
    const h = Math.round(height * window.devicePixelRatio)

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
}

onElementResize(webglContainer, (w, h) => {
  Object.assign(size, { width: w, height: h })
  resizeCanvas(w, h)
  getInstanceWindows().forEach((w) => {
    w.refreshLayout()
    w.redraw()
  })
})

window.api.on(Events.colorschemeStateUpdated, () =>
  requestAnimationFrame(() => {
    // scene().clear_all()
    getInstanceWindows().forEach((w) => w.redraw())
  })
)

const getWinByGridId = (gridId: number) => {
  const win = windows.get(gridId)
  if (!win)
    throw new Error(
      `trying to get window that does not exist ${gridId}`
    )
  return win
}

export const get = getWinByGridId
export const getActiveGridId = () => scene!.get_active_grid_id()
export const setActiveGrid = (gridId: number) => scene!.set_active_grid(gridId)
export const getActive = () => {
  const activeGrid = scene!.get_active_grid_id()
  const win = windows.get(activeGrid)
  if (!win)
    throw new Error(
      `trying to get window that does not exist ${activeGrid}`
    )
  return win
}

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
  const win = windows.get(gridId) || CreateWindow()
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

  if (!windows.has(gridId)) windows.set(gridId, win)
  if (!windowsById.has(winId)) windowsById.set(winId, win)

  // we only want to add grids that have valid window positions and do not
  // overlap coordinates with other windows. this happens rarely (in term
  // buffers) and i think it might be a nvim bug maybe...?

  // behavior 1: multiple "win_pos" events reported with the same row,col (e.g. 0,0)
  // TODO: this is broken. need to check at the redraw level
  // if (windowPosition && windowExistsAtPosition(wid, row, col)) return invalidWindows.add(gid)

  // behavior 2: receive "grid_resize" events (gridId > 1) but no followup "win_pos" events
  if (winId < 0) return invalidWindows.add(gridId)

  container.appendChild(win.element)
  invalidWindows.delete(gridId)
}

export const disposeInvalidWindows = () => {
  invalidWindows.forEach((gid) => {
    const win = windows.get(gid)
    if (!win) throw new Error(`window grid does not exist ${gid}`)
    windows.delete(gid)
    windowsById.delete(win.id)
    invalidWindows.delete(gid)
  })

  // TODO(smolck): ?? 
  // invalidWindows.delete(-1)
}

// i made the assumption that a grid_resize event was always going to follow up
// with a win_pos event. i think however there are grids that never get
// positioned, so we need to make sure they do not get rendered
//
// we also win_pos events that overlap on the same start_col,start_row indexes
// this should not happen on ext_multigrid, maybe floating windows but not here
export const remove = (gridId: number) => {
  const win = windows.get(gridId)
  if (!win)
    return console.warn(
      `trying to destroy a window that does not exist ${gridId}`
    )

  // redraw webgl first before removing DOM element
  // this helps a bit with flickering
  requestAnimationFrame(() => {
    win.element.remove()
    windowsById.delete(win.getWindowInfo().id)
    windows.delete(gridId)
  })
}

export const has = (gridId: number) => windows.has(gridId)

export const layout = () => {
  const wininfos = getInstanceWindows().map((win) => ({
    ...win.getWindowInfo(),
  }))
  const { gridTemplateRows, gridTemplateColumns, windowGridInfo } =
    windowSizer(wininfos)

  Object.assign(container.style, { gridTemplateRows, gridTemplateColumns })

  windowGridInfo.forEach(({ gridId, gridRow, gridColumn }) => {
    windows.get(gridId)!.applyGridStyle({ gridRow, gridColumn })
  })

  // wait for flex grid styles to be applied to all windows and trigger dom layout
  windowGridInfo.forEach(({ gridId }) => windows.get(gridId)!.refreshLayout())
  refreshWebGLGrid()

  // cursorline width does not always get resized correctly after window
  // layout changes, so we will force an update of the cursor to make sure
  // it is correct. test case: two vert splits, move to left and :bo
  requestAnimationFrame(() => {
    // if (!windows.has(scene().get_active_grid_id())) return
    // moveCursor(cursor.row, cursor.col)
  })
}
export const refresh = throttle(updateWindowNameplates, 5)
export const hide = (gridIds: number[][]) => gridIds.forEach(([gridId]) => getWinByGridId(gridId).hide())

export const pixelPosition = (row: number, col: number) => {
  const win = windows.get(scene!.get_active_grid_id())
  if (win) return win.positionToWorkspacePixels(row, col)
  console.warn('no active window grid... hmmm *twisty effect*')
  return { x: 0, y: 0 }
}

export const handle_grid_resize = (gridId: number, width: number, height: number) => {
  scene!.handle_grid_resize(gridId, width, height)
}

export const move_region_up_or_down = (gridId: number, amount: number, top: number, bottom: number) => {
  amount > 0 ?
    scene!.move_region_up(gridId, amount, top, bottom)
    : scene!.move_region_down(gridId, amount, top, bottom)
}

export const handle_grid_line = (e: any) => scene!.handle_grid_line(e)
export const maybe_regen_font_atlas = () => scene!.maybe_regen_font_atlas()
export const force_regen_font_atlas = () => scene!.force_regen_font_atlas()