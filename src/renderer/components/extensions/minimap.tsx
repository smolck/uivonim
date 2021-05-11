import { Events, Invokables } from '../../../common/ipc'
import { asColor } from '../../../common/utils'
import { render } from 'inferno'
import { PluginRight } from '../plugin-container'
import { colors } from '../../render/highlight-attributes'
import { font } from '../../workspace'

// Derived from https://stackoverflow.com/q/5560248
const lightenOrDarkenColor = (col: string, amt: number) => {
  var usePound = false
  if (col[0] == '#') {
    col = col.slice(1)
    usePound = true
  }

  var num = parseInt(col, 16)

  var r = (num >> 16) + amt

  if (r > 255) r = 255
  else if (r < 0) r = 0

  var b = ((num >> 8) & 0x00ff) + amt

  if (b > 255) b = 255
  else if (b < 0) b = 0

  var g = (num & 0x0000ff) + amt

  if (g > 255) g = 255
  else if (g < 0) g = 0

  return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16)
}

let isVisible = false
const Minimap = ({ visible }: { visible: boolean }) => {
  return (
    <PluginRight
      visible={visible}
      setBackground={false}
      extraStyle={{ background: colors.background }}
      width={'150px'}
    >
      <canvas id="minimap-canvas" style="height: 100%;"/>
    </PluginRight>
  )
}

const container = document.createElement('div')
container.id = 'minimap'
document.getElementById('plugins')!.appendChild(container)

let ctxCache: CanvasRenderingContext2D
let canvasCache: HTMLCanvasElement
let linesAndHighlightsCache: any[]

// https://stackoverflow.com/a/18053642
const onClick = (event: MouseEvent) => {
  const rect = canvasCache.getBoundingClientRect()
  // const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const height = canvasCache.height / 200
  const row = Math.floor(y / height)
  window.api.invoke(Invokables.nvimJumpTo, { line: row })
}

const update = (viewport: any, linesAndHighlights?: any[]) => {
  if (linesAndHighlights) linesAndHighlightsCache = linesAndHighlights

  if (!isVisible) render(<Minimap visible={true} />, container)
  if (!ctxCache || !canvasCache) {
    const canvas = (document.getElementById('minimap-canvas') as HTMLCanvasElement)
    const ctx = canvas.getContext('2d')!!
    ctxCache = ctx
    canvasCache = canvas
    ctxCache.scale(window.devicePixelRatio, window.devicePixelRatio)

    // https://stackoverflow.com/a/48309022
    canvas.width = canvas.getBoundingClientRect().width;
    canvas.height = canvas.getBoundingClientRect().height;

    canvas.addEventListener('click', onClick)
  }

  // Background
  ctxCache.beginPath()
  ctxCache.fillStyle = colors.background
  ctxCache.fillRect(0, 0, canvasCache.width, canvasCache.height)

  const width = canvasCache.width / 80
  const height = canvasCache.height / 200

  // Viewport
  ctxCache.beginPath()
  ctxCache.fillStyle = lightenOrDarkenColor(colors.background, 30)
  ctxCache.fillRect(0, viewport.topline * height, canvasCache.width,
                    (viewport.botline * height) - (viewport.topline * height))

  ctxCache.beginPath()
  linesAndHighlightsCache.forEach((line: any[], row) => {
    line.forEach((char, col) => {
      ctxCache.fillStyle = (char.hl ? asColor(char.hl.foreground) : colors.background)!!
      ctxCache.font = `2px ${font.face}`
      ctxCache.fillText(char, col * width, row * height, width)
    })
  })
}

window.api.on(Events.minimap, (linesAndHighlights: any[], viewport) => update(viewport, linesAndHighlights))
window.api.on(Events.minimapUpdate, (viewport) => update(viewport))

window.api.on(Events.minimapHide, () =>
  render(<Minimap visible={false} />, container)
)
