import {
  size as windowsGridSize,
} from '../windows/window-manager'
import CreateWindowNameplate, { NameplateState } from '../windows/nameplate'
import { highlightLookup } from '../highlight-attributes'
// import { getCharFromIndex } from '../render/font-texture-atlas'
import { specs as titleSpecs } from '../title'
import { Scene } from '../render/pkg'
import { cell } from '../workspace'
import { makel } from '../ui/vanilla'

export interface WindowInfo {
  id: number
  gridId: number // TODO(smolck)
  row: number
  col: number
  width: number
  height: number
  visible: boolean
  is_float: boolean
  anchor: string
}

interface GridStyle {
  gridRow: string
  gridColumn: string
}

export interface WindowOverlay {
  remove(): void
  move(row: number, col: number): void
}

interface PosOpts {
  within?: boolean
  padding?: boolean
}

interface HighlightCell {
  row: number
  col: number
  char: string
}

const edgeDetection = (el: HTMLElement) => {
  const size = el.getBoundingClientRect()
  const top = Math.round(size.top)
  const bottom = Math.round(size.bottom)
  const left = Math.round(size.left)
  const right = Math.round(size.right)
  const edges = Object.create(null)

  if (left === 0) edges.borderLeft = 'none'
  if (top === titleSpecs.height) edges.borderTop = 'none'
  if (bottom - titleSpecs.height === windowsGridSize.height)
    edges.borderBottom = 'none'
  if (right === windowsGridSize.width) edges.borderRight = 'none'
  return edges
}

export const paddingX = 5
export const paddingY = 4

const positionToWorkspacePixels = (layout: { x: number, y: number, width: number, height: number }, row: number, col: number, maybeOpts?: PosOpts) => {
  const { within = false, padding = true } = maybeOpts || ({} as PosOpts)
  const winX = Math.floor(col * cell.width)
  const winY = Math.floor(row * cell.height)

  const x = winX + (padding ? paddingX : 0) + (within ? 0 : layout.x)

  const y = winY + (padding ? paddingY : 0) + (within ? 0 : layout.y)

  return { x, y }
}

const createWindow = () => {
  const wininfo: WindowInfo = {
    id: 0,
    gridId: 0,
    row: 0,
    col: 0,
    width: 0,
    height: 0,
    visible: true,
    is_float: false,
    anchor: '',
  }
  const layout = { x: 0, y: 0, width: 0, height: 0 }

  const container = makel({
    flexFlow: 'column',
    background: 'none',
    display: 'flex',
  })

  const content = makel({
    display: 'flex',
    flex: 1,
    background: 'none',
    position: 'relative',
  })

  const overlay = makel({
    display: 'flex',
    position: 'absolute',
    width: '100%',
    height: '100%',
  })

  const nameplate = CreateWindowNameplate()

  overlay.setAttribute('wat', 'overlay')
  content.setAttribute('wat', 'content')
  nameplate.element.setAttribute('wat', 'nameplate')

  Object.assign(nameplate.element.style, {
    background: 'var(--background-30)',
  })

  content.appendChild(overlay)
  container.appendChild(nameplate.element)
  container.appendChild(content)

  return {
    get id() {
      return wininfo.id
    },
    get gridId() {
      return wininfo.gridId
    },
    get row() {
      return wininfo.row
    },
    get col() {
      return wininfo.col
    },
    get rows() {
      return wininfo.height
    },
    get cols() {
      return wininfo.width
    },
    get visible() {
      return wininfo.visible
    },
    get element() {
      return container
    },

    positionToWorkspacePixels: (row: number, col: number, maybeOpts?: PosOpts) => positionToWorkspacePixels(layout, row, col, maybeOpts),
    resizeWindow: (width: number, height: number) => {
      Object.assign(wininfo, { height, width })
      // scene.handle_grid_resize(wininfo.gridId, width, height)
    },

    setWindowInfo: (info: WindowInfo) => {
      if (info.is_float) {
        let { x, y } = positionToWorkspacePixels(layout,
          info.row, info.col, {
          within: true,
          padding: false,
        })
        x = Math.max(0, Math.min(x, windowsGridSize.width))
        y = Math.max(0, Math.min(y, windowsGridSize.height))

        const xPx = `${x}px`
        const yPx = `${y + paddingY}px`

        // TODO(smolck): Remove nameplate completely for floats?
        Object.assign(nameplate.element.style, {
          display: 'none',
        })

        Object.assign(container.style, {
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: yPx,
          left: xPx,
        })
      }

      if (!wininfo.visible) {
        container.style.display = 'flex'
        // scene.render_grid(info.gridId)
      }

      container.id = `${info.id}`
      container.setAttribute('gridid', info.gridId.toString())
      Object.assign(wininfo, info)
    },

    getWindowInfo: (): WindowInfo => ({ ...wininfo }),

    getWindowSize: () => ({
      width: layout.width,
      height: layout.height,
    }),

    applyGridStyle: ({ gridRow, gridColumn }: GridStyle) => {
      Object.assign(container.style, { gridColumn, gridRow })
    },

    hide: () => {
      wininfo.visible = false
      container.style.display = 'none'
      // scene.clear_grid(wininfo.gridId)
    },

    clear: () => {
      // scene.clear_grid(wininfo.gridId)
    },

    // maybeHide + maybeShow used for hiding/showing windows when
    // switching between vim instances. nvim controls the true visiblity
    // state of the windows. the maybe funcs show or hide in a way that
    // respects the true nvim visibility state of the windows
    // TODO(smolck): Guess we can get rid of this then since no longer have the multiple 
    // instances feature?
    /*maybeHide = () => {
        if (!wininfo.visible) return
        container.style.display = 'none'
        scene.clear_grid(wininfo.gridId)
      },
  
    maybeShow = () => {
        if (!wininfo.visible) return
        container.style.display = 'flex'
        webgl.renderGridBuffer()
      }*/

    refreshLayout: () => {
      const { top, left, width, height } = content.getBoundingClientRect()

      const x = left
      const y = top - titleSpecs.height

      const same =
        layout.x === x &&
        layout.y === y &&
        layout.width === width &&
        layout.height === height

      if (same) return

      Object.assign(layout, { x, y, width, height })
      // TODO(smolck): webgl.layout(x + paddingX, y + paddingY, width, height)

      // Don't add border to floats.
      if (!wininfo.is_float) {
        Object.assign(
          container.style,
          {
            border: '1px solid var(--background-30)',
          },
          edgeDetection(container)
        )
      }
    },

    addOverlayElement: (element: HTMLElement) => {
      overlay.appendChild(element)
      return {
        remove: () => element.remove(),
        move: (row: number, col: number) => {
          // TODO: i like to move it move it
          console.warn('NYI: overlay element move', row, col)
        },
      }
    },

    redraw: () => {}, // scene.render_grid(wininfo.gridId),
    updateNameplate: (data: NameplateState) => nameplate.update(data),

    editor: {
      getChar: (row: number, col: number) => {
        /*const maybeChar = scene.get_cell_from_grid(wininfo.gridId, row, col)
        if (typeof maybeChar === 'string') {
          throw new Error(maybeChar)
        } else {
          return maybeChar.char // See `Cell` type in src/renderer/render/src/grid.rs
        }*/
        return "hi"
      },
      getLine: (row: number) => {
        /*const line = scene.get_line_from_grid(wininfo.gridId, row)
        if (typeof line === 'string') {
          throw new Error(line)
        } else {
          return line.map((c: any) => c.char) // See `Cell` type in src/renderer/render/src/grid.rs
        }*/
        return []
      },
      getAllLines: () => {
        const lines: any = []
        for (let row = 0; row < wininfo.height; row++) {
          // TODO(smolck): Just have a wasm func for this?
          /*const line = scene.get_line_from_grid(wininfo.gridId, row)
          if (typeof line === 'string') {
            throw new Error(line)
          } else {
            lines.push(line.map((c: any) => c.char)) // See `Cell` type in src/renderer/render/src/grid.rs
          }*/
        }
        return lines
      },
      findHighlightCells: (highlightGroup: string): HighlightCell[] => {
        const highlights = highlightLookup(highlightGroup).map((m) => m.hlid)
        if (!highlights.length) return []

        const results: any = []

        for (let row = 0; row < wininfo.height; row++) {
          for (let col = 0; col < wininfo.width; col++) {
            /*const cell = scene.get_cell_from_grid(wininfo.gridId, row, col) // TODO(smolck): Error handling?
            console.assert(typeof cell !== 'string', cell)

            if (highlights.includes(cell.hl_id))
              results.push({
                col, row, // TODO(smolck)
                char: cell.char,
              })*/
          }
        }

        return results
      },
      positionToEditorPixels: (line: number, col: number, maybeOpts: PosOpts) => {
        const { within = false, padding = true } = maybeOpts || ({} as PosOpts)
        const row = line - window.api.nvimState().editorTopLine
        const winX = Math.floor(col * cell.width)
        const winY = Math.floor(row * cell.height)

        const x = winX + (padding ? paddingX : 0) + (within ? 0 : layout.x)

        const y = winY + (padding ? paddingY : 0) + (within ? 0 : layout.y)

        return { x, y }
      },
    }
  }
}

export type Window = ReturnType<typeof createWindow>
export default createWindow