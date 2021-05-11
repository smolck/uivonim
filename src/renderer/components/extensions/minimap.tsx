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

let ctx: CanvasRenderingContext2D
let canvas: HTMLCanvasElement
let linesAndHighlightsCache: any[]
let viewportCache: any

const maxLines = 200

// https://stackoverflow.com/a/18053642
const onClick = (event: MouseEvent) => {
  const rect = canvas.getBoundingClientRect()
  const y = event.clientY - rect.top

  const height = canvas.height / maxLines
  const row = Math.floor(y / height) + (viewportCache.botline > maxLines ? viewportCache.botline - maxLines : 0)
  window.api.invoke(Invokables.nvimJumpTo, { line: row })
}

const update = (viewport: any, linesAndHighlights?: any[]) => {
  if (linesAndHighlights) linesAndHighlightsCache = linesAndHighlights
  viewportCache = viewport

  if (!isVisible) render(<Minimap visible={true} />, container)
  if (!ctx || !canvas) {
    canvas = (document.getElementById('minimap-canvas') as HTMLCanvasElement)
    ctx = canvas.getContext('2d')!!
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // https://stackoverflow.com/a/48309022
    canvas.width = canvas.getBoundingClientRect().width;
    canvas.height = canvas.getBoundingClientRect().height;

    canvas.addEventListener('click', onClick)
  }

  // Background
  ctx.beginPath()
  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const width = canvas.width / 80
  const height = canvas.height / maxLines

  // Viewport
  ctx.beginPath()
  ctx.fillStyle = lightenOrDarkenColor(colors.background, 30)
  const needsAName = viewport.botline - maxLines
  const y = viewport.botline > maxLines ? (viewport.topline - needsAName) * height : viewport.topline * height
  ctx.fillRect(0, y, canvas.width, (viewport.botline * height) - (viewport.topline * height))

  ctx.beginPath()
  const start = viewport.botline > maxLines ? viewport.botline - maxLines : 0
  const end = viewport.botline > maxLines ? viewport.botline : maxLines
  linesAndHighlightsCache.slice(start, end).forEach((line: any[], row) => {
    line.forEach((char, col) => {
      ctx.fillStyle = (char.hl ? asColor(char.hl.foreground) : colors.background)!!
      ctx.font = `2px ${font.face}`
      ctx.fillText(char, col * width, row * height, width)
    })
  })
}

window.api.on(Events.minimap, (linesAndHighlights: any[], viewport) => update(viewport, linesAndHighlights))
window.api.on(Events.minimapUpdate, (viewport) => update(viewport))

window.api.on(Events.minimapHide, () =>
  render(<Minimap visible={false} />, container)
)
