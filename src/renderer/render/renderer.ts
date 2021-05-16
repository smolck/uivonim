import { Invokables } from '../../common/ipc'
import { asColor } from '../../common/utils'
import { font } from '../workspace'
import { sub, pub } from '../dispatch'
import { colors } from './highlight-attributes'

type HighlightInfo = {
  // TODO(smolck): Make sure that these types being optionald doesn't break
  // `if`s or anything. TBH not quite sure that could even happen but y'know.
  background?: string
  foreground?: string
  bold?: boolean
  blend?: number
  italic?: boolean
  reverse?: boolean
  special?: string
  strikethrough?: boolean
  undercurl?: boolean
  underline?: boolean
}

// We then have a GridSize type. We need this type in order to keep track of
// the size of grids. Storing this information here can appear redundant since
// the grids are represented as arrays and thus have a .length attribute, but
// it's not: storing grid size in a separate datastructure allows us to never
// have to shrink arrays, and to not need allocations if enlarging an array
// that has been shrinked.
type GridDimensions = {
  width: number
  height: number
}

enum DamageKind {
  Cell,
  Resize,
  Scroll,
}

// Used to track rectangles of damage done to a grid and only repaint the
// necessary bits. These are logic positions (i.e. cells) - not pixels.
type CellDamage = {
  kind: DamageKind
  // The number of rows the damage spans
  h: number
  // The number of columns the damage spans
  w: number
  // The column the damage begins at
  x: number
  // The row the damage begins at
  y: number
}

type ResizeDamage = {
  kind: DamageKind
  // The new height of the canvas
  h: number
  // The new width of the canvas
  w: number
  // The previous width of the canvas
  x: number
  // The previous height of the canvas
  y: number
}

type ScrollDamage = {
  kind: DamageKind
  // The direction of the scroll, -1 means up, 1 means down
  h: number
  // The number of lines of the scroll, positive number
  w: number
  // The top line of the scrolling region, in cells
  x: number
  // The bottom line of the scrolling region, in cells
  y: number
}

type GridDamage = CellDamage & ResizeDamage & ScrollDamage

type Cursor = {
  currentGrid: number
  display: boolean
  col: number
  row: number
  lastMove: DOMHighResTimeStamp
}

export interface RendererView {
  resize: (rows: number, cols: number) => void
  layout: (x: number, y: number, width: number, height: number) => void
  render: () => void
  clear: () => void
  getChar: (row: number, col: number) => string
  getLine: (row: number) => string
  updateGridId: (gridId: number) => void
  canvas: HTMLCanvasElement
}

const newHighlight = (bg?: string, fg?: string): HighlightInfo => {
  return {
    background: bg,
    foreground: fg,
  }
}

const setCanvasDimensions = (canvas: HTMLCanvasElement, width: number, height: number) => {
  canvas.width = width * window.devicePixelRatio
  canvas.height = height * window.devicePixelRatio
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
}

const createRenderer = () => {
  const mode = {
    current: 0,
    styleEnabled: false,
    modeInfo: [
      {
        attr_id: 0,
        attr_id_lm: 0,
        blinkoff: 0,
        blinkon: 0,
        blinkwait: 0,
        cell_percentage: 0,
        cursor_shape: 'block',
        name: 'normal',
      },
    ],
  }

  const cursor: Cursor = {
    currentGrid: 1,
    display: true,
    col: 0,
    row: 0,
    lastMove: performance.now(),
  }

  const gridCharacters: string[][][] = []
  const gridDamages: GridDamage[][] = []
  const gridDamagesCount: number[] = []
  const gridHighlights: number[][][] = []
  const gridSizes: GridDimensions[] = []
  const highlights: HighlightInfo[] = [
    newHighlight(colors.background, colors.foreground),
  ]

  let linespace = 0
  let glyphCache: any = {}
  let metricsInvalidated = false

  const wipeGlyphCache = () => {
    glyphCache = {}
  }

  const invalidateMetrics = () => {
    metricsInvalidated = true
    wipeGlyphCache()
  }

  const glyphId = (char: string, high: number) => {
    return char + '-' + high
  }

  let fontString = `${font.size} ${font.face}`

  const getGlyphInfo = (ctx: CanvasRenderingContext2D) => {
    if (
      metricsInvalidated ||
      maxCellWidth === undefined ||
      maxCellHeight === undefined ||
      maxBaselineDistance === undefined
    ) {
      recomputeCharSize(ctx)
    }
    return [maxCellWidth, maxCellHeight, maxBaselineDistance]
  }

  const pushDamage = (
    grid: number,
    kind: DamageKind,
    h: number,
    w: number,
    x: number,
    y: number
  ) => {
    const damages = gridDamages[grid]
    const count = gridDamagesCount[grid]
    if (damages.length === count) {
      damages.push({ kind, h, w, x, y })
    } else {
      damages[count].kind = kind
      damages[count].h = h
      damages[count].w = w
      damages[count].x = x
      damages[count].y = y
    }
    gridDamagesCount[grid] = count + 1
  }

  let maxCellWidth: number
  let maxCellHeight: number
  let maxBaselineDistance: number
  const recomputeCharSize = (ctx: CanvasRenderingContext2D) => {
    // 94, K+32: we ignore the first 32 ascii chars because they're non-printable
    const chars = new Array(94)
      .fill(0)
      .map((_, k) => String.fromCharCode(k + 32))
      // Concatening Â because that's the tallest character I can think of.
      .concat(['Â'])
    let width = 0
    let height = 0
    let baseline = 0
    let measure: TextMetrics
    for (const char of chars) {
      measure = ctx.measureText(char)
      if (measure.width > width) {
        width = measure.width
      }
      let tmp = Math.abs(measure.actualBoundingBoxAscent)
      if (tmp > baseline) {
        baseline = tmp
      }
      tmp += Math.abs(measure.actualBoundingBoxDescent)
      if (tmp > height) {
        height = tmp
      }
    }
    maxCellWidth = Math.ceil(width)
    maxCellHeight = Math.ceil(height) + linespace
    maxBaselineDistance = baseline
    metricsInvalidated = false
  }

  const measureWidth = (ctx: CanvasRenderingContext2D, char: string) => {
    const charWidth = getGlyphInfo(ctx)[0]
    return Math.ceil(ctx.measureText(char).width / charWidth) * charWidth
  }

  let activeGrid = 1

  // keep track of wheter a frame is already being scheduled or not. This avoids
  // asking for multiple frames where we'd paint the same thing anyway.
  let frameScheduled: any = {}
  function scheduleFrame(gridId: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    if (!frameScheduled[gridId]) {
      frameScheduled[gridId] = true
      window.requestAnimationFrame(() => paint(gridId, canvas, ctx))
    }
  }

  const paint = (gridId: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    frameScheduled[gridId] = false

    const charactersGrid = gridCharacters[gridId]
    const highlightsGrid = gridHighlights[gridId]
    const damages = gridDamages[gridId]
    const damageCount = gridDamagesCount[gridId]
    const [charWidth, charHeight, baseline] = getGlyphInfo(ctx)

    for (let i = 0; i < damageCount; ++i) {
      const damage = damages[i]
      switch (damage.kind) {
        case DamageKind.Resize:
          {
            const pixelWidth = (damage.w * charWidth) / window.devicePixelRatio
            const pixelHeight =
              (damage.h * charHeight) / window.devicePixelRatio
            // TODO(smolck): page.resizeEditor(pixelWidth, pixelHeight)
            setCanvasDimensions(canvas, pixelWidth, pixelHeight)
            // Note: changing width and height resets font, so we have to
            // set it again. Who thought this was a good idea???
            ctx.font = fontString
          }
          break
        case DamageKind.Scroll:
        case DamageKind.Cell:
          for (
            let y = damage.y;
            y < damage.y + damage.h && y < charactersGrid.length;
            ++y
          ) {
            const row = charactersGrid[y]
            const rowHigh = highlightsGrid[y]
            const pixelY = y * charHeight

            for (
              let x = damage.x;
              x < damage.x + damage.w && x < row.length;
              ++x
            ) {
              if (row[x] === '') {
                continue
              }
              const pixelX = x * charWidth
              const id = glyphId(row[x], rowHigh[x])

              if (glyphCache[id] === undefined) {
                const cellHigh = highlights[rowHigh[x]]
                const width =
                  Math.ceil(measureWidth(ctx, row[x]) / charWidth) * charWidth
                let background = cellHigh.background || highlights[0].background
                let foreground = cellHigh.foreground || highlights[0].foreground
                if (cellHigh.reverse) {
                  const tmp = background
                  background = foreground
                  foreground = tmp
                }

                ctx.fillStyle = background || ''
                ctx.fillRect(pixelX, pixelY, width, charHeight)
                ctx.fillStyle = foreground || ''

                let fontStr = ''
                let changeFont = false
                if (cellHigh.bold) {
                  fontStr += ' bold '
                  changeFont = true
                }
                if (cellHigh.italic) {
                  fontStr += ' italic '
                  changeFont = true
                }
                if (changeFont) {
                  ctx.font = fontStr + fontString
                }
                ctx.fillText(row[x], pixelX, pixelY + baseline)
                if (changeFont) {
                  ctx.font = fontString
                }

                if (cellHigh.strikethrough) {
                  ctx.fillRect(pixelX, pixelY + baseline / 2, width, 1)
                }
                ctx.fillStyle = cellHigh.special || ''
                const baselineHeight = charHeight - baseline
                if (cellHigh.underline) {
                  const linepos = baselineHeight * 0.3
                  ctx.fillRect(pixelX, pixelY + baseline + linepos, width, 1)
                }
                if (cellHigh.undercurl) {
                  const curlpos = baselineHeight * 0.6
                  for (
                    let abscissa = pixelX;
                    abscissa < pixelX + width;
                    ++abscissa
                  ) {
                    ctx.fillRect(
                      abscissa,
                      pixelY + baseline + curlpos + Math.cos(abscissa),
                      1,
                      1
                    )
                  }
                }
                // reason for the check: we can't retrieve pixels
                // drawn outside the viewport
                if (
                  pixelX >= 0 &&
                  pixelY >= 0 &&
                  pixelX + width < canvas.width &&
                  pixelY + charHeight < canvas.height
                ) {
                  glyphCache[id] = ctx.getImageData(
                    pixelX,
                    pixelY,
                    width,
                    charHeight
                  )
                }
              } else {
                ctx.putImageData(glyphCache[id], pixelX, pixelY)
              }
            }
          }
          break
      }
    }

    if (cursor.display) {
      if (cursor.currentGrid === gridId) {
        // Missing: handling of cell-percentage
        const info = mode.styleEnabled
          ? mode.modeInfo[mode.current]
          : mode.modeInfo[0]
        // Decide color. As described in the doc, if attr_id is 0 colors
        // should be reverted.
        let background = highlights[modeHlId].background
        let foreground = highlights[modeHlId].foreground
        if (info.attr_id === 0) {
          const tmp = background
          background = foreground
          foreground = tmp
        }

        // Decide cursor shape. Default to block, change to
        // vertical/horizontal if needed.
        const cursorWidth = cursor.col * charWidth
        let cursorHeight = cursor.row * charHeight
        let width = charWidth
        let height = charHeight
        if (info.cursor_shape === 'vertical') width = 1
        else if (info.cursor_shape === 'horizontal') {
          cursorHeight += charHeight - 2
          height = 1
        }

        // Finally draw cursor
        ctx.fillStyle = background || ''
        ctx.fillRect(cursorWidth, cursorHeight, width, height)

        if (info.cursor_shape === 'block') {
          ctx.fillStyle = foreground || ''
          const char = charactersGrid[cursor.row][cursor.col]
          ctx.fillText(
            char,
            cursor.col * charWidth,
            cursor.row * charHeight + baseline
          )
        }
      }
    }

    gridDamagesCount[gridId] = 0
  }

  let modeHlId = 0
  const createView = (initialGridId: number): RendererView => {
    let gridId = initialGridId

    const canvas = document.createElement('canvas') as HTMLCanvasElement
    canvas.id = `renderer-canvas-${gridId}`
    const ctx = canvas.getContext('2d', { alpha: false })!!
    fontString = `${font.size}px ${font.face}`
    ctx.font = `${font.size}px ${font.face}`

    const viewport = { x: 0, y: 0, width: 0, height: 0 }
    const gridSize = { rows: 0, cols: 0 }

    sub('workspace.font.updated', ({ size, face, lineSpace }) => {
      const newFont = `${size}px ${face}`
      fontString = newFont
      ctx.font = newFont
      invalidateMetrics()

      const [charWidth, charHeight] = getGlyphInfo(ctx)
      window.api.invoke(
        Invokables.nvimResizeGrid,
        activeGrid,
        Math.floor(canvas.width / charWidth),
        Math.floor(canvas.height / charHeight)
      )

      if (linespace === lineSpace) {
        return
      }

      // TODO(smolck)
      linespace = lineSpace
      // invalidateMetrics()
      // const [charWidth, charHeight] = getGlyphInfo(state)
      const gid = activeGrid
      const curGridSize = gridSizes[gid]
      if (curGridSize !== undefined) {
        pushDamage(
          activeGrid,
          DamageKind.Cell,
          curGridSize.height,
          curGridSize.width,
          0,
          0
        )
      }
    })
    sub('resize', () => {
      invalidateMetrics()
      const [charWidth, charHeight] = getGlyphInfo(ctx)
      window.api.invoke(
        Invokables.nvimResizeGrid,
        activeGrid,
        Math.floor(canvas.width / charWidth),
        Math.floor(canvas.height / charHeight)
      )
    })

    sub('mode_change', () => scheduleFrame(gridId, canvas, ctx))
    sub('flush', (grid) => gridId === grid ? scheduleFrame(gridId, canvas, ctx) : {})

    const updateGridId = (newGridId: number) => {
      gridId = newGridId
      canvas.id = `renderer-canvas-${gridId}`
    }

    const resize = (rows: number, cols: number) => {
      /*const [charWidth, charHeight] = getGlyphInfo(ctx)

      const width = cols * charWidth
      const height = rows * charHeight

      const sameGridSize = gridSize.rows === rows && gridSize.cols === cols
      const sameViewportSize =
        viewport.height === height && viewport.width === width
      if (sameGridSize || sameViewportSize) return

      Object.assign(gridSize, { rows, cols })
      invalidateMetrics()
      setCanvasDimensions(canvas, viewport.width, viewport.height)
      scheduleFrame(gridId, canvas, ctx)*/
    }

    const layout = (x: number, y: number, width: number, height: number) => {
      // invalidateMetrics()
      // scheduleFrame(gridId, canvas, ctx)
      /*const same =
        viewport.x === x &&
        viewport.y === y &&
        viewport.width === width &&
        viewport.height === height

      if (same) return

      Object.assign(viewport, { x, y, width, height })
      setCanvasDimensions(canvas, viewport.width, viewport.height)
      ctx.font = fontString*/
    }

    const render = () => {
      scheduleFrame(gridId, canvas, ctx)
    }

    const clear = () => {
      // const dims = gridSizes[gridId]
      // pushDamage(gridId, DamageKind.Cell, dims.height, dims.width, 0, 0)
    }

    return {
      clear,
      render,
      resize,
      layout,
      updateGridId,
      getChar: (row: number, col: number) => gridCharacters[gridId][row][col],
      getLine: (row: number) => gridCharacters[gridId][row].join(''),
      canvas,
    }
  }

  return {
    setModeHlId: (id: number) => (modeHlId = id),
    showCursor: (enable: boolean) => {
      cursor.display = enable
    },
    createView: (gridId: number) => createView(gridId),
    cursor,
    handlers: {
      mode_change: (_modeAsStr: string, modeIdx: number) => {
        mode.current = modeIdx
        if (mode.styleEnabled) {
          pushDamage(activeGrid, DamageKind.Cell, 1, 1, cursor.col, cursor.row)
          pub('mode_change')
        }
      },
      mode_info_set: (cursorStyleEnabled: boolean, modeInfo: []) => {
        // Missing: handling of cell-percentage
        mode.styleEnabled = cursorStyleEnabled
        mode.modeInfo = modeInfo
      },
      busy_start: () => {
        pushDamage(activeGrid, DamageKind.Cell, 1, 1, cursor.col, cursor.row)
        cursor.display = false
      },
      busy_stop: () => {
        cursor.display = true
      },
      default_colors_set: (fg: number, bg: number, sp: number) => {
        if (fg !== undefined && fg !== -1) {
          highlights[0].foreground = asColor(fg)
        }
        if (bg !== undefined && bg !== -1) {
          highlights[0].background = asColor(bg)
        }
        if (sp !== undefined && sp !== -1) {
          highlights[0].special = asColor(sp)
        }
        const curGridSize = gridSizes[activeGrid]
        if (curGridSize !== undefined) {
          pushDamage(
            activeGrid,
            DamageKind.Cell,
            curGridSize.height,
            curGridSize.width,
            0,
            0
          )
        }
        wipeGlyphCache()
      },
      flush: () => {
        pub('flush', activeGrid)
      },
      grid_clear: (id: number) => {
        // glacambre: What should actually happen on grid_clear? The
        //            documentation says "clear the grid", but what does that
        //            mean? I guess the characters should be removed, but what
        //            about the highlights? Are there other things that need to
        //            be cleared?
        // bfredl: to default bg color
        //         grid_clear is not meant to be used often
        //         it is more "the terminal got screwed up, better to be safe
        //         than sorry"
        const charGrid = gridCharacters[id]
        const highGrid = gridHighlights[id]
        const dims = gridSizes[id]
        for (let j = 0; j < dims.height; ++j) {
          for (let i = 0; i < dims.width; ++i) {
            charGrid[j][i] = ' '
            highGrid[j][i] = 0
          }
        }
        pushDamage(id, DamageKind.Cell, dims.height, dims.width, 0, 0)
      },
      grid_cursor_goto: (id: number, row: number, column: number) => {
        pushDamage(activeGrid, DamageKind.Cell, 1, 1, cursor.col, cursor.row)
        cursor.currentGrid = id
        cursor.col = column
        cursor.row = row
        cursor.lastMove = performance.now()
        activeGrid = id
      },
      grid_line: (id: number, row: number, col: number, changes: any[]) => {
        const charGrid = gridCharacters[id]
        const highlights = gridHighlights[id]
        let prevCol = col
        let high = 0
        for (let i = 0; i < changes.length; ++i) {
          const change = changes[i]
          const chara = change[0]
          if (change[1] !== undefined) {
            high = change[1]
          }
          const repeat = change[2] === undefined ? 1 : change[2]
          pushDamage(id, DamageKind.Cell, 1, repeat, prevCol, row)

          const limit = prevCol + repeat
          for (let j = prevCol; j < limit; j += 1) {
            charGrid[row][j] = chara
            highlights[row][j] = high
          }
          prevCol = limit
        }
      },
      grid_resize: (id: number, width: number, height: number) => {
        const createGrid = gridCharacters[id] === undefined
        if (createGrid) {
          gridCharacters[id] = []
          gridCharacters[id].push([])
          gridSizes[id] = { width: 0, height: 0 }
          gridDamages[id] = []
          gridDamagesCount[id] = 0
          gridHighlights[id] = []
          gridHighlights[id].push([])
        }

        const curGridSize = gridSizes[id]

        pushDamage(
          id,
          DamageKind.Resize,
          height,
          width,
          curGridSize.width,
          curGridSize.height
        )

        const highlights = gridHighlights[id]
        const charGrid = gridCharacters[id]
        if (width > charGrid[0].length) {
          for (let i = 0; i < charGrid.length; ++i) {
            const row = charGrid[i]
            const highs = highlights[i]
            while (row.length < width) {
              row.push(' ')
              highs.push(0)
            }
          }
        }
        if (height > charGrid.length) {
          while (charGrid.length < height) {
            charGrid.push(new Array(width).fill(' '))
            highlights.push(new Array(width).fill(0))
          }
        }
        pushDamage(id, DamageKind.Cell, 0, width, 0, curGridSize.height)
        curGridSize.width = width
        curGridSize.height = height
      },
      grid_scroll: (
        id: number,
        top: number,
        bot: number,
        left: number,
        right: number,
        rows: number,
        _cols: number
      ) => {
        const dimensions = gridSizes[id]
        const charGrid = gridCharacters[id]
        const highGrid = gridHighlights[id]
        if (rows > 0) {
          const bottom =
            bot + rows >= dimensions.height ? dimensions.height - rows : bot
          for (let y = top; y < bottom; ++y) {
            const srcChars = charGrid[y + rows]
            const dstChars = charGrid[y]
            const srcHighs = highGrid[y + rows]
            const dstHighs = highGrid[y]
            for (let x = left; x < right; ++x) {
              dstChars[x] = srcChars[x]
              dstHighs[x] = srcHighs[x]
            }
          }
          pushDamage(
            id,
            DamageKind.Cell,
            dimensions.height,
            dimensions.width,
            0,
            0
          )
        } else if (rows < 0) {
          for (let y = bot - 1; y >= top && y + rows >= 0; --y) {
            const srcChars = charGrid[y + rows]
            const dstChars = charGrid[y]
            const srcHighs = highGrid[y + rows]
            const dstHighs = highGrid[y]
            for (let x = left; x < right; ++x) {
              dstChars[x] = srcChars[x]
              dstHighs[x] = srcHighs[x]
            }
          }
          pushDamage(
            id,
            DamageKind.Cell,
            dimensions.height,
            dimensions.width,
            0,
            0
          )
        }
      },
      hl_attr_define: (id: number, rgbAttr: any) => {
        if (highlights[id] === undefined) {
          highlights[id] = newHighlight(undefined, undefined)
        }
        highlights[id].foreground = asColor(rgbAttr.foreground)
        highlights[id].background = asColor(rgbAttr.background)
        highlights[id].bold = rgbAttr.bold
        highlights[id].blend = rgbAttr.blend
        highlights[id].italic = rgbAttr.italic
        highlights[id].special = asColor(rgbAttr.special)
        highlights[id].strikethrough = rgbAttr.strikethrough
        highlights[id].undercurl = rgbAttr.undercurl
        highlights[id].underline = rgbAttr.underline
        highlights[id].reverse = rgbAttr.reverse
      },
    },
  }
}

export default createRenderer
export type Renderer = ReturnType<typeof createRenderer>
