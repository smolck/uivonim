// From https://github.com/glacambre/firenvim/blob/bd334382c48905d4e74a90e52bd9b0e90d64bcb7/src/utils/configuration.ts#L1-L19
// These modes are defined in https://github.com/neovim/neovim/blob/master/src/nvim/cursor_shape.c
export type NvimMode =
  | 'all'
  | 'normal'
  | 'visual'
  | 'insert'
  | 'replace'
  | 'cmdline_normal'
  | 'cmdline_insert'
  | 'cmdline_replace'
  | 'operator'
  | 'visual_select'
  | 'cmdline_hover'
  | 'statusline_hover'
  | 'statusline_drag'
  | 'vsep_hover'
  | 'vsep_drag'
  | 'more'
  | 'more_lastline'
  | 'showmatch'

let functions: any
export function setFunctions(fns: any) {
  functions = fns
}

let glyphCache: any = {}
function wipeGlyphCache() {
  glyphCache = {}
}

let metricsInvalidated = false

function invalidateMetrics() {
  metricsInvalidated = true
  wipeGlyphCache()
}

let fontString: string
function setFontString(state: State, s: string) {
  fontString = s
  state.context.font = fontString
  invalidateMetrics()
}
function glyphId(char: string, high: number) {
  return char + '-' + high
}
function setCanvasDimensions(
  cvs: HTMLCanvasElement,
  width: number,
  height: number
) {
  cvs.width = width * window.devicePixelRatio
  cvs.height = height * window.devicePixelRatio
  cvs.style.width = `${width}px`
  cvs.style.height = `${height}px`
}
function makeFontString(fontSize: string, fontFamily: string) {
  return `${fontSize} ${fontFamily}`
}
let defaultFontSize = ''
const defaultFontFamily = 'monospace'
let defaultFontString = ''
export function setCanvas(cvs: HTMLCanvasElement) {
  const state = globalState
  state.canvas = cvs
  setCanvasDimensions(state.canvas, window.innerWidth, window.innerHeight)
  defaultFontSize = window.getComputedStyle(state.canvas).fontSize
  defaultFontString = makeFontString(defaultFontSize, defaultFontFamily)
  state.context = state.canvas.getContext('2d', { alpha: false })
  setFontString(state, defaultFontString)
}

// We first define highlight information.
const defaultBackground = '#FFFFFF'
const defaultForeground = '#000000'
type HighlightInfo = {
  background: string
  bold: boolean
  blend: number
  foreground: string
  italic: boolean
  reverse: boolean
  special: string
  strikethrough: boolean
  undercurl: boolean
  underline: boolean
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
  x: number
  y: number
  lastMove: DOMHighResTimeStamp
}

type Mode = {
  current: number
  styleEnabled: boolean
  modeInfo: {
    attr_id: number
    attr_id_lm: number
    blinkoff: number
    blinkon: number
    blinkwait: number
    cell_percentage: number
    cursor_shape: string
    name: NvimMode
  }[]
}

type State = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  cursor: Cursor
  gridCharacters: string[][][]
  gridDamages: GridDamage[][]
  gridDamagesCount: number[]
  gridHighlights: number[][][]
  gridSizes: GridDimensions[]
  highlights: HighlightInfo[]
  linespace: number
  mode: Mode
}

const globalState: State = {
  canvas: undefined,
  context: undefined,
  cursor: {
    currentGrid: 1,
    display: true,
    x: 0,
    y: 0,
    lastMove: performance.now(),
  },
  gridCharacters: [],
  gridDamages: [],
  gridDamagesCount: [],
  gridHighlights: [],
  gridSizes: [],
  highlights: [newHighlight(defaultBackground, defaultForeground)],
  linespace: 0,
  mode: {
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
  },
}

function pushDamage(
  grid: number,
  kind: DamageKind,
  h: number,
  w: number,
  x: number,
  y: number
) {
  const damages = globalState.gridDamages[grid]
  const count = globalState.gridDamagesCount[grid]
  if (damages.length === count) {
    damages.push({ kind, h, w, x, y })
  } else {
    damages[count].kind = kind
    damages[count].h = h
    damages[count].w = w
    damages[count].x = x
    damages[count].y = y
  }
  globalState.gridDamagesCount[grid] = count + 1
}

let maxCellWidth: number
let maxCellHeight: number
let maxBaselineDistance: number
function recomputeCharSize(ctx: CanvasRenderingContext2D) {
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
  maxCellHeight = Math.ceil(height) + globalState.linespace
  maxBaselineDistance = baseline
  metricsInvalidated = false
}
export function getGlyphInfo(state: State) {
  if (
    metricsInvalidated ||
    maxCellWidth === undefined ||
    maxCellHeight === undefined ||
    maxBaselineDistance === undefined
  ) {
    recomputeCharSize(state.context)
  }
  return [maxCellWidth, maxCellHeight, maxBaselineDistance]
}
function measureWidth(state: State, char: string) {
  const charWidth = getGlyphInfo(state)[0]
  return (
    Math.ceil(state.context.measureText(char).width / charWidth) * charWidth
  )
}

export function getLogicalSize() {
  const state = globalState
  const [cellWidth, cellHeight] = getGlyphInfo(state)
  return [
    Math.floor(state.canvas.width / cellWidth),
    Math.floor(state.canvas.height / cellHeight),
  ]
}

export function computeGridDimensionsFor(width: number, height: number) {
  const [cellWidth, cellHeight] = getGlyphInfo(globalState)
  return [Math.floor(width / cellWidth), Math.floor(height / cellHeight)]
}

export function getGridCoordinates(x: number, y: number) {
  const [cellWidth, cellHeight] = getGlyphInfo(globalState)
  return [
    Math.floor((x * window.devicePixelRatio) / cellWidth),
    Math.floor((y * window.devicePixelRatio) / cellHeight),
  ]
}

function newHighlight(bg: string, fg: string): HighlightInfo {
  return {
    background: bg,
    bold: undefined,
    blend: undefined,
    foreground: fg,
    italic: undefined,
    reverse: undefined,
    special: undefined,
    strikethrough: undefined,
    undercurl: undefined,
    underline: undefined,
  }
}

export function getGridId() {
  return 1
}

export function getCurrentMode() {
  const mode = globalState.mode
  return mode.modeInfo[mode.current].name
}

const handlers: { [key: string]: (...args: any[]) => void } = {
  busy_start: () => {
    pushDamage(
      getGridId(),
      DamageKind.Cell,
      1,
      1,
      globalState.cursor.x,
      globalState.cursor.y
    )
    globalState.cursor.display = false
  },
  busy_stop: () => {
    globalState.cursor.display = true
  },
  default_colors_set: (fg: number, bg: number, sp: number) => {
    if (fg !== undefined && fg !== -1) {
      globalState.highlights[0].foreground = toHexCss(fg)
    }
    if (bg !== undefined && bg !== -1) {
      globalState.highlights[0].background = toHexCss(bg)
    }
    if (sp !== undefined && sp !== -1) {
      globalState.highlights[0].special = toHexCss(sp)
    }
    const curGridSize = globalState.gridSizes[getGridId()]
    if (curGridSize !== undefined) {
      pushDamage(
        getGridId(),
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
    scheduleFrame()
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
    const charGrid = globalState.gridCharacters[id]
    const highGrid = globalState.gridHighlights[id]
    const dims = globalState.gridSizes[id]
    for (let j = 0; j < dims.height; ++j) {
      for (let i = 0; i < dims.width; ++i) {
        charGrid[j][i] = ' '
        highGrid[j][i] = 0
      }
    }
    pushDamage(id, DamageKind.Cell, dims.height, dims.width, 0, 0)
  },
  grid_cursor_goto: (id: number, row: number, column: number) => {
    const cursor = globalState.cursor
    pushDamage(getGridId(), DamageKind.Cell, 1, 1, cursor.x, cursor.y)
    cursor.currentGrid = id
    cursor.x = column
    cursor.y = row
    cursor.lastMove = performance.now()
  },
  grid_line: (id: number, row: number, col: number, changes: any[]) => {
    const charGrid = globalState.gridCharacters[id]
    const highlights = globalState.gridHighlights[id]
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
    const state = globalState
    const createGrid = state.gridCharacters[id] === undefined
    if (createGrid) {
      state.gridCharacters[id] = []
      state.gridCharacters[id].push([])
      state.gridSizes[id] = { width: 0, height: 0 }
      state.gridDamages[id] = []
      state.gridDamagesCount[id] = 0
      state.gridHighlights[id] = []
      state.gridHighlights[id].push([])
    }

    const curGridSize = globalState.gridSizes[id]

    pushDamage(
      id,
      DamageKind.Resize,
      height,
      width,
      curGridSize.width,
      curGridSize.height
    )

    const highlights = globalState.gridHighlights[id]
    const charGrid = globalState.gridCharacters[id]
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
    const dimensions = globalState.gridSizes[id]
    const charGrid = globalState.gridCharacters[id]
    const highGrid = globalState.gridHighlights[id]
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
      pushDamage(id, DamageKind.Cell, dimensions.height, dimensions.width, 0, 0)
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
      pushDamage(id, DamageKind.Cell, dimensions.height, dimensions.width, 0, 0)
    }
  },
  hl_attr_define: (id: number, rgbAttr: any) => {
    const highlights = globalState.highlights
    if (highlights[id] === undefined) {
      highlights[id] = newHighlight(undefined, undefined)
    }
    highlights[id].foreground = toHexCss(rgbAttr.foreground)
    highlights[id].background = toHexCss(rgbAttr.background)
    highlights[id].bold = rgbAttr.bold
    highlights[id].blend = rgbAttr.blend
    highlights[id].italic = rgbAttr.italic
    highlights[id].special = toHexCss(rgbAttr.special)
    highlights[id].strikethrough = rgbAttr.strikethrough
    highlights[id].undercurl = rgbAttr.undercurl
    highlights[id].underline = rgbAttr.underline
    highlights[id].reverse = rgbAttr.reverse
  },
  mode_change: (_: string, modeIdx: number) => {
    globalState.mode.current = modeIdx
    if (globalState.mode.styleEnabled) {
      const cursor = globalState.cursor
      pushDamage(getGridId(), DamageKind.Cell, 1, 1, cursor.x, cursor.y)
      scheduleFrame()
    }
  },
  mode_info_set: (cursorStyleEnabled: boolean, modeInfo: []) => {
    // Missing: handling of cell-percentage
    const mode = globalState.mode
    mode.styleEnabled = cursorStyleEnabled
    mode.modeInfo = modeInfo
  },
  option_set: (option: string, value: any) => {
    const state = globalState
    switch (option) {
      case 'guifont':
        {
          let newFontString
          if (value === '') {
            newFontString = defaultFontString
          } else {
            const guifont = parseGuifont(value, {
              'font-family': defaultFontFamily,
              'font-size': defaultFontSize,
            })
            newFontString = makeFontString(
              guifont['font-size'],
              guifont['font-family']
            )
          }
          if (newFontString === fontString) {
            break
          }
          setFontString(state, newFontString)
          const [charWidth, charHeight] = getGlyphInfo(state)
          functions.ui_try_resize_grid(
            getGridId(),
            Math.floor(state.canvas.width / charWidth),
            Math.floor(state.canvas.height / charHeight)
          )
        }
        break
      case 'linespace':
        {
          if (state.linespace === value) {
            break
          }
          state.linespace = value
          invalidateMetrics()
          const [charWidth, charHeight] = getGlyphInfo(state)
          const gid = getGridId()
          const curGridSize = state.gridSizes[gid]
          if (curGridSize !== undefined) {
            pushDamage(
              getGridId(),
              DamageKind.Cell,
              curGridSize.height,
              curGridSize.width,
              0,
              0
            )
          }
          functions.ui_try_resize_grid(
            gid,
            Math.floor(state.canvas.width / charWidth),
            Math.floor(state.canvas.height / charHeight)
          )
        }
        break
    }
  },
}

// keep track of wheter a frame is already being scheduled or not. This avoids
// asking for multiple frames where we'd paint the same thing anyway.
let frameScheduled = false
function scheduleFrame() {
  if (!frameScheduled) {
    frameScheduled = true
    window.requestAnimationFrame(paint)
  }
}

function paint(_: DOMHighResTimeStamp) {
  frameScheduled = false

  const state = globalState
  const canvas = state.canvas
  const context = state.context
  const gid = getGridId()
  const charactersGrid = state.gridCharacters[gid]
  const highlightsGrid = state.gridHighlights[gid]
  const damages = state.gridDamages[gid]
  const damageCount = state.gridDamagesCount[gid]
  const highlights = state.highlights
  const [charWidth, charHeight, baseline] = getGlyphInfo(state)

  for (let i = 0; i < damageCount; ++i) {
    const damage = damages[i]
    switch (damage.kind) {
      case DamageKind.Resize:
        {
          const pixelWidth = (damage.w * charWidth) / window.devicePixelRatio
          const pixelHeight = (damage.h * charHeight) / window.devicePixelRatio
          page.resizeEditor(pixelWidth, pixelHeight)
          setCanvasDimensions(canvas, pixelWidth, pixelHeight)
          // Note: changing width and height resets font, so we have to
          // set it again. Who thought this was a good idea???
          context.font = fontString
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
                Math.ceil(measureWidth(state, row[x]) / charWidth) * charWidth
              let background = cellHigh.background || highlights[0].background
              let foreground = cellHigh.foreground || highlights[0].foreground
              if (cellHigh.reverse) {
                const tmp = background
                background = foreground
                foreground = tmp
              }
              context.fillStyle = background
              context.fillRect(pixelX, pixelY, width, charHeight)
              context.fillStyle = foreground
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
                context.font = fontStr + fontString
              }
              context.fillText(row[x], pixelX, pixelY + baseline)
              if (changeFont) {
                context.font = fontString
              }
              if (cellHigh.strikethrough) {
                context.fillRect(pixelX, pixelY + baseline / 2, width, 1)
              }
              context.fillStyle = cellHigh.special
              const baselineHeight = charHeight - baseline
              if (cellHigh.underline) {
                const linepos = baselineHeight * 0.3
                context.fillRect(pixelX, pixelY + baseline + linepos, width, 1)
              }
              if (cellHigh.undercurl) {
                const curlpos = baselineHeight * 0.6
                for (
                  let abscissa = pixelX;
                  abscissa < pixelX + width;
                  ++abscissa
                ) {
                  context.fillRect(
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
                glyphCache[id] = context.getImageData(
                  pixelX,
                  pixelY,
                  width,
                  charHeight
                )
              }
            } else {
              context.putImageData(glyphCache[id], pixelX, pixelY)
            }
          }
        }
        break
    }
  }

  if (state.cursor.display) {
    const cursor = state.cursor
    if (cursor.currentGrid === gid) {
      // Missing: handling of cell-percentage
      const mode = state.mode
      const info = mode.styleEnabled
        ? mode.modeInfo[mode.current]
        : mode.modeInfo[0]
      const shouldBlink =
        info.blinkwait > 0 && info.blinkon > 0 && info.blinkoff > 0

      // Decide color. As described in the doc, if attr_id is 0 colors
      // should be reverted.
      let background = highlights[info.attr_id].background
      let foreground = highlights[info.attr_id].foreground
      if (info.attr_id === 0) {
        const tmp = background
        background = foreground
        foreground = tmp
      }

      // Decide cursor shape. Default to block, change to
      // vertical/horizontal if needed.
      const cursorWidth = cursor.x * charWidth
      let cursorHeight = cursor.y * charHeight
      let width = charWidth
      let height = charHeight
      if (info.cursor_shape === 'vertical') {
        width = 1
      } else if (info.cursor_shape === 'horizontal') {
        cursorHeight += charHeight - 2
        height = 1
      }

      const now = performance.now()
      // Decide if the cursor should be inverted. This only happens if
      // blinking is on, we've waited blinkwait time and we're in the
      // "blinkoff" time slot.
      const blinkOff =
        shouldBlink &&
        now - info.blinkwait > cursor.lastMove &&
        now % (info.blinkon + info.blinkoff) > info.blinkon
      if (blinkOff) {
        const high = highlights[highlightsGrid[cursor.y][cursor.x]]
        background = high.background
        foreground = high.foreground
      }

      // Finally draw cursor
      context.fillStyle = background
      context.fillRect(cursorWidth, cursorHeight, width, height)

      if (info.cursor_shape === 'block') {
        context.fillStyle = foreground
        const char = charactersGrid[cursor.y][cursor.x]
        context.fillText(
          char,
          cursor.x * charWidth,
          cursor.y * charHeight + baseline
        )
      }

      if (shouldBlink) {
        // if the cursor should blink, we need to paint continuously
        const relativeNow = performance.now() % (info.blinkon + info.blinkoff)
        const nextPaint =
          relativeNow < info.blinkon
            ? info.blinkon - relativeNow
            : info.blinkoff - (relativeNow - info.blinkon)
        setTimeout(scheduleFrame, nextPaint)
      }
    }
  }

  state.gridDamagesCount[gid] = 0
}

export function onRedraw(events: any[]) {
  for (let i = 0; i < events.length; ++i) {
    const event = events[i]
    const handler = (handlers as any)[event[0] as any]
    if (handler !== undefined) {
      for (let j = 1; j < event.length; ++j) {
        handler.apply(globalState, event[j])
      }
    } else {
      // console.error(`${event[0]} is not implemented.`);
    }
  }
}
